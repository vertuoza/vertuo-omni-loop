// The device sign-in (PRD 1660; RFC 8628's shape, as `gh auth login` and `vercel login` take it): the
// terminal asks the Omni page for a request, prints its link and its short code, and polls the page
// until the person approves the request in any browser. The browser never talks to the terminal, so
// it works where the loopback cannot: a Claude Code cloud session, an SSH box, a Codespace.
//
//   POST <ask.url>/api/ask/device {purpose: signin} | {purpose: token, name, days, workspace}
//        → {device_code, user_code, url, interval, expires_in}   404 or 503: no device sign-in here
//   POST <ask.url>/api/ask/device/poll {device_code}, every `interval` seconds
//        → {status: pending | slow_down (interval) | expired | denied}
//        → {status: approved, code} (signin) | {status: approved, token, expires_at} (token)
//
// The body's `status` is what this module reads, never the HTTP status (the page's contract,
// apps/galaxy/src/ask/device.contract.ts; PRD 1660, s1-02). It is to the device flow what
// `startLoopback` (`./loopback.ts`) is to the loopback: a request to wait on, and `close()`.
import type { Session } from '../env/read.ts';
import { jsonObject } from './schema.ts';
import type { Fetch } from './client.ts';
import { askEndpoint } from './credentials.ts';

/** How a sign-in reaches the terminal: by polling the page, or by the browser coming back to 127.0.0.1. */
export type Flow = 'device' | 'loopback';

/**
 * The flow a sign-in takes: the one `forced` names (`--device`, `--loopback`), else `device` in a
 * remote session (the browser is on another machine) or on Linux with no display (no browser here),
 * else `loopback`.
 */
export function chooseFlow(session: Session, platform: NodeJS.Platform, forced: Flow | null = null): Flow {
  if (forced) return forced;
  if (session.remote) return 'device';
  return platform === 'linux' && !session.display ? 'device' : 'loopback';
}

/** The page a person approves a request on: `<ask.url>/ask/device?user_code=<code>`. */
export function deviceLink(askUrl: string, userCode: string): string {
  const link = new URL(askEndpoint(askUrl, '/ask/device'));
  link.searchParams.set('user_code', userCode);
  return link.toString();
}

/** Why a device request ended without its approval. `unavailable`: the page has no device sign-in (an
 * older page, or one without its database key), so the loopback may take over. */
export type DeviceReason = 'unavailable' | 'unreachable' | 'denied' | 'expired' | 'closed';

export class DeviceError extends Error {
  readonly reason: DeviceReason;

  constructor(reason: DeviceReason) {
    super(`the device sign-in ended: ${reason}`);
    this.name = 'DeviceError';
    this.reason = reason;
  }
}

/** What an approved request hands over: the one-time code (signin), or the kit token and its expiry. */
export type DeviceApproval = { code: string } | { token: string; expiresAt: string | null };

/** A request issued and waited on. */
export type Device = {
  userCode: string;
  /** The page to approve it on, under `ask.url`. */
  url: string;
  /** How long the request waits for its approval. */
  waitMs: number;
  /** Polls until approved; rejects with a {@link DeviceError}. Called again, gives the same promise. */
  poll(): Promise<DeviceApproval>;
  /** Stops polling: a `poll()` still waiting ends `closed`. */
  close(): Promise<void>;
};

/** What a request asks for: a sign-in, or a kit token with its name, lifetime and workspace. */
type DevicePurpose =
  | { purpose: 'signin' }
  | { purpose: 'token'; name: string; days: number; workspace: string | null };

/** How long each call to the page may take. */
const DEVICE_CALL_MS = 10_000;
/** The seconds a `slow_down` adds when it names no interval (RFC 8628, 3.5). */
const SLOW_DOWN_S = 2;

type Options = DevicePurpose & {
  askUrl: string;
  fetch?: Fetch;
  /** Waits `ms`, or less when `signal` aborts. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
};

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

/** POSTs `body` to `path` under `ask.url`: the response, or `null` when the page cannot be reached. */
async function post(fetch: Fetch, askUrl: string, path: string, body: object, signal: AbortSignal): Promise<Response | null> {
  try {
    return await fetch(askEndpoint(askUrl, path), {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(DEVICE_CALL_MS)]),
    });
  } catch {
    return null;
  }
}

async function bodyOf(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return jsonObject(await response.json());
  } catch {
    return null;
  }
}

const ends = (reason: DeviceReason) => (): never => {
  throw new DeviceError(reason);
};

/** How each `status` a poll answers is read: the interval until the next poll (the same while
 * pending, longer on a slow_down), the approval it hands over, or the {@link DeviceError} it ends on. */
const ANSWERS: Readonly<Record<string, (body: Record<string, unknown>, seconds: number) => DeviceApproval | number>> = {
  pending: (_body, seconds) => seconds,
  slow_down: (body, seconds) => (positive(body.interval) ? body.interval : seconds + SLOW_DOWN_S),
  denied: ends('denied'),
  expired: ends('expired'),
  approved: (body) => approvalOf(body) ?? ends('unreachable')(),
};

/** What a poll's answer means, as {@link ANSWERS} reads it; any other answer ends `unreachable`. */
function outcomeOf(body: Record<string, unknown> | null, seconds: number): DeviceApproval | number {
  const status = body?.status;
  const read = typeof status === 'string' && Object.hasOwn(ANSWERS, status) ? ANSWERS[status] : undefined;
  if (!body || !read) throw new DeviceError('unreachable');
  return read(body, seconds);
}

/** The code, or the token and its expiry, an approved answer hands over; `null` when it holds neither. */
function approvalOf(body: Record<string, unknown>): DeviceApproval | null {
  if (text(body.code)) return { code: body.code };
  if (text(body.token)) return { token: body.token, expiresAt: text(body.expires_at) ? body.expires_at : null };
  return null;
}

/** The request body `purpose` asks for. */
function requestOf(request: DevicePurpose): object {
  return request.purpose === 'signin'
    ? { purpose: 'signin' }
    : { purpose: 'token', name: request.name, days: request.days, workspace: request.workspace };
}

/**
 * Issues a device request on the page `askUrl` names. Rejects with a {@link DeviceError}:
 * `unavailable` on a 404 or a 503, `unreachable` when the page cannot be reached or answers anything
 * else.
 */
export async function startDevice(options: Options): Promise<Device> {
  const { askUrl, fetch = globalThis.fetch, sleep = wait, now = Date.now } = options;
  const stop = new AbortController();
  const response = await post(fetch, askUrl, '/api/ask/device', requestOf(options), stop.signal);
  if (response?.status === 404 || response?.status === 503) throw new DeviceError('unavailable');
  const issued = response?.ok ? await bodyOf(response) : null;
  const { device_code: deviceCode, user_code: userCode, interval, expires_in: expiresIn } = issued ?? {};
  if (!text(deviceCode) || !text(userCode) || !positive(interval) || !positive(expiresIn)) throw new DeviceError('unreachable');
  const firstInterval = interval;
  const waitMs = expiresIn * 1000;
  const deadline = now() + waitMs;

  /** Throws `closed` once `close()` was called. */
  function stillOpen(): void {
    if (stop.signal.aborted) throw new DeviceError('closed');
  }

  /** One poll's outcome: the approval, or the interval until the next poll. */
  async function pollOnce(seconds: number): Promise<DeviceApproval | number> {
    const answer = await post(fetch, askUrl, '/api/ask/device/poll', { device_code: deviceCode }, stop.signal);
    stillOpen();
    return outcomeOf(answer ? await bodyOf(answer) : null, seconds);
  }

  async function run(): Promise<DeviceApproval> {
    let seconds = firstInterval;
    for (;;) {
      stillOpen();
      await sleep(seconds * 1000, stop.signal);
      stillOpen();
      if (now() >= deadline) throw new DeviceError('expired');
      const outcome = await pollOnce(seconds);
      if (typeof outcome !== 'number') return outcome;
      seconds = outcome;
    }
  }

  let polling: Promise<DeviceApproval> | null = null;
  return {
    userCode,
    url: deviceLink(askUrl, userCode),
    waitMs,
    poll() {
      polling ??= run();
      return polling;
    },
    close() {
      stop.abort();
      return Promise.resolve();
    },
  };
}
