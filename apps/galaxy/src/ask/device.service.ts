// The device sign-in's rules (PRD 1660, s1; ./device.contract.ts for the routes): a terminal anywhere
// asks for a request, prints its link and its user code, and polls until the person approves it in any
// browser. The browser never talks to the terminal.
//
// The device code is the terminal's secret: 32 random bytes, kept only as its SHA-256. The user code is
// what the person matches by eye: 8 characters without look-alikes, shown XXXX-XXXX, read without case
// or dash. A request waits 10 minutes; a poll sooner than its interval answers slow_down and adds 2
// seconds (RFC 8628); an approved request's payload is handed over once, the request deleted by the same
// call. Every time is this server's clock, given to the store, so the rules are proven here on a fake.
import 'server-only';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { readTokenRequest } from './kit-token';
import {
  DEVICE_INTERVAL_S, DEVICE_TTL_MS, SLOW_DOWN_S, USER_CODE_ALPHABET, USER_CODE_LENGTH,
  type DevicePayload, type DevicePurpose, type DeviceRequest, type DeviceStore, type IssuedDevice, type PollAnswer,
} from './device.contract';

const DEVICE_CODE = /^[A-Za-z0-9_-]{43}$/;
const USER_CODE = new RegExp(`^[${USER_CODE_ALPHABET}]{${USER_CODE_LENGTH}}$`);
/** How many user codes issuing draws before it gives up: a clash among live requests is rare. */
const USER_CODE_TRIES = 5;

/** 32 random bytes, URL-safe: the terminal's secret. */
export const newDeviceCode = () => randomBytes(32).toString('base64url');

/** What the store keeps of a device code: its SHA-256, in hex. */
export const hashDeviceCode = (code: string) => createHash('sha256').update(code).digest('hex');

/** 8 characters of the alphabet, each drawn without bias (`pick(n)` gives 0 to n-1). */
export function newUserCode(pick: (n: number) => number = randomInt): string {
  return Array.from({ length: USER_CODE_LENGTH }, () => USER_CODE_ALPHABET.charAt(pick(USER_CODE_ALPHABET.length))).join('');
}

/** A user code as shown: XXXX-XXXX. */
export const formatUserCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** A user code as stored: upper case, no dash or space; null when it cannot be one. */
export function normalizeUserCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  return USER_CODE.test(code) ? code : null;
}

/** A body's shape, before readTokenRequest's rules: nothing but these fields, of these types. */
const DeviceBody = z.union([
  z.strictObject({ purpose: z.literal('signin') }),
  z.strictObject({ purpose: z.literal('token'), name: z.string().optional(), days: z.number().optional(), workspace: z.string().optional() }),
]);

/** The request a body asks for, or null: `{purpose: "signin"}` and nothing else, or
 * `{purpose: "token", name?, days?, workspace?}` validated by the very rules /ask/signin?purpose=token
 * applies to its query (readTokenRequest), its way back aside: the device flow has none. */
export function readDeviceRequest(body: unknown, today: Date): DeviceRequest | null {
  const parsed = DeviceBody.safeParse(body);
  if (!parsed.success) return null;
  if (parsed.data.purpose === 'signin') return { purpose: 'signin' };
  const params = new URLSearchParams({ purpose: 'token', back: '/app/device' });
  for (const [key, value] of Object.entries(parsed.data)) if (key !== 'purpose' && value !== undefined) params.set(key, String(value));
  const read = readTokenRequest(params, today);
  return read ? { purpose: 'token', name: read.name, days: read.days, workspace: read.workspace } : null;
}

/** A pending request found by its user code, for /ask/device. */
export type FoundDevice = { user_code: string; request: DeviceRequest };

export type DeviceService = {
  issue(request: DeviceRequest): Promise<IssuedDevice>;
  poll(deviceCode: string): Promise<PollAnswer>;
  /** Attaches the payload to the pending request under `userCode`, once; whether it did. */
  approve(userCode: string, purpose: DevicePurpose, payload: string, payloadExpiresAt?: string | null): Promise<boolean>;
  /** Marks the pending request under `userCode` denied; whether it did. */
  deny(userCode: string): Promise<boolean>;
  /** The request under `userCode` while it is pending and in time, or null (unknown, used, denied,
   * expired, or no user code at all). */
  find(userCode: string): Promise<FoundDevice | null>;
};

export type DeviceDeps = {
  now?: () => number;
  /** Opens a kit token sealed with the server's key; null when this deployment has none. */
  open?: ((sealed: string) => string) | null;
  /** Draws a user code (tests pin it). */
  userCode?: () => string;
};

/** The device sign-in over `store`. A failing store throws. */
export function deviceService(store: DeviceStore, deps: DeviceDeps = {}): DeviceService {
  const now = deps.now ?? Date.now;
  const iso = (ms: number) => new Date(ms).toISOString();
  const draw = deps.userCode ?? (() => newUserCode());

  /** An approved request's payload, taken: `expired` when another poll took it first. */
  function handOver(taken: DevicePayload | null): PollAnswer {
    if (!taken) return { status: 'expired' };
    if (taken.purpose === 'signin') return { status: 'approved', code: taken.payload };
    if (!deps.open) throw new Error('ask_cli_device: a token waits, but this deployment has no key to open it with');
    return { status: 'approved', token: deps.open(taken.payload), expires_at: taken.payload_expires_at };
  }

  return {
    async issue(request) {
      const deviceCode = newDeviceCode();
      const at = now();
      for (let tries = 0; tries < USER_CODE_TRIES; tries += 1) {
        const userCode = draw();
        const stored = await store.issue({
          device_hash: hashDeviceCode(deviceCode), user_code: userCode, request, now: iso(at), expires_at: iso(at + DEVICE_TTL_MS),
        });
        if (stored === 'issued') {
          return { device_code: deviceCode, user_code: formatUserCode(userCode), interval: DEVICE_INTERVAL_S, expires_in: DEVICE_TTL_MS / 1000 };
        }
      }
      throw new Error(`ask_cli_device_issue: no free user code after ${USER_CODE_TRIES} tries`);
    },

    async poll(deviceCode) {
      if (!DEVICE_CODE.test(deviceCode)) return { status: 'expired' };
      const hash = hashDeviceCode(deviceCode);
      const row = await store.read(hash);
      const at = now();
      if (!row || !(Date.parse(row.expires_at) > at)) return { status: 'expired' };
      if (row.status === 'denied') return { status: 'denied' };
      if (row.status === 'approved') return handOver(await store.take(hash));
      const soon = row.last_polled_at !== null && at - Date.parse(row.last_polled_at) < row.interval * 1000;
      const interval = soon ? row.interval + SLOW_DOWN_S : row.interval;
      await store.polled(hash, iso(at), interval);
      return soon ? { status: 'slow_down', interval } : { status: 'pending' };
    },

    async approve(userCode, purpose, payload, payloadExpiresAt = null) {
      const code = normalizeUserCode(userCode);
      return code ? store.approve(code, purpose, payload, payloadExpiresAt, iso(now())) : false;
    },

    async deny(userCode) {
      const code = normalizeUserCode(userCode);
      return code ? store.deny(code, iso(now())) : false;
    },

    async find(userCode) {
      const code = normalizeUserCode(userCode);
      if (!code) return null;
      const row = await store.find(code);
      if (!row || row.status !== 'pending' || !(Date.parse(row.expires_at) > now())) return null;
      if (row.purpose === 'signin') return { user_code: formatUserCode(code), request: { purpose: 'signin' } };
      const days = row.days === 30 || row.days === 365 ? row.days : 90;
      return { user_code: formatUserCode(code), request: { purpose: 'token', name: row.name ?? '', days, workspace: row.workspace } };
    },
  };
}
