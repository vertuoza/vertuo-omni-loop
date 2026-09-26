// The sign-in `omni signin` keeps, and the one-time code it trades for it. One store for the whole
// kit: `~/.config/omni/credentials.json` at mode 0600, keyed by the host of `ask.url` (its port
// included), each entry the token exchange's own reply `{ access_token, refresh_token, expires_at,
// email }`. The hooks read and renew the same file through `client-tokens.mjs`; this module reads and
// writes through it too, and adds only what the hooks never do: forgetting a host (`omni signout`).
// It lives in the person's home, never in a repository, since one sign-in serves every checkout.
import { chmodSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { homeTokens } from './client-tokens.mjs';

const FILE = ['.config', 'omni', 'credentials.json'];

/** How long the token exchange may take. */
export const EXCHANGE_TIMEOUT_MS = 10_000;

export class SignInError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SignInError';
  }
}

/** The key a sign-in is kept under: the host of `ask.url`, with its port. */
export const credentialsHost = (askUrl) => new URL(askUrl).host;

/** Where a call of the contract goes: a path under `ask.url`, which may itself carry a path. */
export const askEndpoint = (askUrl, path) => `${askUrl.replace(/\/+$/, '')}${path}`;

const isText = (value) => typeof value === 'string' && value.length > 0;

/**
 * The entry kept for a host, from the token exchange's reply: its four fields, or `null` when the
 * reply lacks an access token, a refresh token or an email.
 */
export function tokenEntry(reply) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return null;
  const { access_token, refresh_token, expires_at, email } = reply;
  if (!isText(access_token) || !isText(refresh_token) || !isText(email)) return null;
  return { access_token, refresh_token, expires_at: typeof expires_at === 'number' ? expires_at : null, email };
}

/** @param {{ home?: string }} [options] */
export function credentials({ home = homedir() } = {}) {
  const file = join(home, ...FILE);
  const tokens = homeTokens({ home });
  return {
    file,
    /** The host's entry, or `null`. */
    read: (host) => tokens.read(host),
    /** Keeps the host's entry, and every other host's, at mode 0600. */
    write: (host, entry) => tokens.write(host, entry),
    /** Forgets the host; `true` when it had an entry. The file goes with its last host. */
    remove(host) {
      let all;
      try {
        all = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        return false;
      }
      if (!all || typeof all !== 'object' || Array.isArray(all) || !Object.hasOwn(all, host)) return false;
      delete all[host];
      if (Object.keys(all).length === 0) {
        rmSync(file, { force: true });
      } else {
        writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 });
        chmodSync(file, 0o600);
      }
      return true;
    },
  };
}

async function replyOf(response) {
  const text = await response.text().catch(() => '');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/**
 * Trades the one-time code the sign-in page handed back for the person's tokens:
 * `POST <ask.url>/api/ask/token {code}`. Throws a `SignInError` saying why when it cannot.
 */
export async function exchangeCode({ askUrl, code, fetch = globalThis.fetch, timeoutMs = EXCHANGE_TIMEOUT_MS }) {
  const endpoint = askEndpoint(askUrl, '/api/ask/token');
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const why = error?.name === 'TimeoutError' ? 'it did not answer in time' : 'it is unreachable';
    throw new SignInError(`could not reach ${credentialsHost(askUrl)} to finish the sign-in: ${why}.`);
  }
  const reply = await replyOf(response);
  if (!response.ok) {
    const reason = isText(reply?.error) ? reply.error : `HTTP ${response.status}`;
    throw new SignInError(`the sign-in was refused: ${reason}`);
  }
  const entry = tokenEntry(reply);
  if (!entry) throw new SignInError('the sign-in server answered with no tokens.');
  return entry;
}
