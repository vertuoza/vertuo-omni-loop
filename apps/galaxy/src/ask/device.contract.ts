// The device sign-in (PRD 1660, spec "The flow"; RFC 8628's shape): what its two routes answer, and
// the store its service asks of the database (20261205090000_ask_cli_devices.sql).
//
//   POST /api/ask/device {purpose: "signin"}
//                        {purpose: "token", name?, days?: 30 | 90 | 365, workspace?}
//        → 200 {device_code, user_code: "WXYZ-4821", url: <origin>/ask/device?user_code=WXYZ-4821,
//               interval: 3, expires_in: 600}
//        → 400 a body of any other shape · 413 over MAX_TOKEN_BODY_BYTES · 503 no database here
//   POST /api/ask/device/poll {device_code}
//        → 200 {status: "pending"}
//        → 429 {status: "slow_down", interval}       polled sooner than its interval: 2 s more
//        → 410 {status: "expired"}                   past its 10 minutes, unknown, or handed over
//        → 403 {status: "denied"}                    No was pressed on /ask/device
//        → 200 {status: "approved", code}                     a signin request, handed over once
//        → 200 {status: "approved", token, expires_at}        a token request, handed over once
//        → 400 a body of any other shape · 413 too large · 503 no database here · 500 the store failed
//
// The terminal reads the body's `status`; the HTTP status says the same for anyone reading logs.
// Every answer is `cache-control: no-store`.

/** How long a device request waits for its approval. */
export const DEVICE_TTL_MS = 10 * 60_000;
/** The seconds a terminal waits between two polls, at first. */
export const DEVICE_INTERVAL_S = 3;
/** The seconds a `slow_down` adds to the interval (RFC 8628, 3.5). */
export const SLOW_DOWN_S = 2;
/** The characters of a user code (the spec's alphabet): no vowel, no Y, no 0 or 1. */
export const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789';
/** A user code's length, without its dash. */
export const USER_CODE_LENGTH = 8;

export type DevicePurpose = 'signin' | 'token';
export type DeviceStatus = 'pending' | 'approved' | 'denied';

/** A device request as asked: `signin`, or a kit token with its name, days and workspace (its slug, or
 * null for the person's first one). */
export type DeviceRequest =
  | { purpose: 'signin' }
  | { purpose: 'token'; name: string; days: 30 | 90 | 365; workspace: string | null };

/** A request as the store keeps it, read by its device code's hash or its user code. Times are ISO. */
export type DeviceRow = {
  status: DeviceStatus;
  purpose: DevicePurpose;
  name: string | null;
  days: number | null;
  workspace: string | null;
  interval: number;
  last_polled_at: string | null;
  expires_at: string;
};

/** An approved request's payload, taken (and so deleted) once: the one-time code for `signin`, the kit
 * token sealed with the server's key for `token`, with the token's own expiry. */
export type DevicePayload = { purpose: DevicePurpose; payload: string; payload_expires_at: string | null };

/** What the service asks of the database: each call throws when the database fails. A user code is
 * always given normalized (8 characters, upper case, no dash). */
export type DeviceStore = {
  /** Stores a new pending request, clearing those past their time first; `taken` when the user code
   * is in use already. */
  issue(row: { device_hash: string; user_code: string; request: DeviceRequest; now: string; expires_at: string }): Promise<'issued' | 'taken'>;
  /** The request under this device code's hash, or null. */
  read(deviceHash: string): Promise<DeviceRow | null>;
  /** Records a poll of a pending request: when it came, and the interval from now on. */
  polled(deviceHash: string, at: string, interval: number): Promise<void>;
  /** Deletes an approved request and returns its payload; null when it is not approved (any more). */
  take(deviceHash: string): Promise<DevicePayload | null>;
  /** The request under this user code, or null. */
  find(userCode: string): Promise<DeviceRow | null>;
  /** Attaches `payload` to the request under this user code, only while it is pending, in time and of
   * this purpose; whether it did. */
  approve(userCode: string, purpose: DevicePurpose, payload: string, payloadExpiresAt: string | null, at: string): Promise<boolean>;
  /** Marks the request under this user code denied, only while it is pending and in time; whether it did. */
  deny(userCode: string, at: string): Promise<boolean>;
};

/** What a poll answers, before it becomes a response. */
export type PollAnswer =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'approved'; code: string }
  | { status: 'approved'; token: string; expires_at: string | null };

/** What issuing answers. */
export type IssuedDevice = { device_code: string; user_code: string; interval: number; expires_in: number };
