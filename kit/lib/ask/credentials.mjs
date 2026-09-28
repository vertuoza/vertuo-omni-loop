// The sign-in `omni signin` keeps, and the one-time code it trades for it. One store for the whole
// kit: `~/.config/omni/credentials.json` at mode 0600, keyed by the host of `ask.url` (its port
// included), each entry the token exchange's own reply `{ access_token, refresh_token, expires_at,
// email?, login? }`: the email only when the account has one (GitHub lets a person keep theirs
// private), the GitHub login when the page gives it (PRD 459). The hooks read and renew the same file through `client-tokens.mjs`; this module reads and
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
 * The entry kept for a host, from the token exchange's reply: the two tokens and their expiry, with
 * the email and the GitHub login when the reply has them, or `null` when it lacks a token.
 */
export function tokenEntry(reply) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return null;
  const { access_token, refresh_token, expires_at, email, login } = reply;
  if (!isText(access_token) || !isText(refresh_token)) return null;
  return {
    access_token,
    refresh_token,
    expires_at: typeof expires_at === 'number' ? expires_at : null,
    ...(isText(email) ? { email } : {}),
    ...(isText(login) ? { login } : {}),
  };
}

/** The workspace a reply names, as `{slug, name}`, or `null`. */
function workspaceOf(value) {
  if (!value || typeof value !== 'object' || !isText(value.name)) return null;
  return { slug: isText(value.slug) ? value.slug : null, name: value.name };
}

/**
 * The line a sign-in ends on (PRD 459): who signed in and, when the page said, where `repo`'s calls
 * go — to a workspace, or the page's reason why none (which carries the App's install link when no
 * workspace owns it yet). All of them are a sign-in that worked.
 *
 * @param {{ login?: string|null, email?: string|null, repo?: string|null, workspace?: { name: string }|null, reason?: string|null }} o
 */
export function signedInLine({ login, email, repo, workspace, reason } = {}) {
  const who = isText(login) ? login : isText(email) ? email : null;
  const head = who ? `signed in as ${who}` : 'signed in';
  if (!isText(repo)) return head;
  if (workspace && isText(workspace.name)) return `${head} — ${repo} goes to ${workspace.name}`;
  if (isText(reason)) return `${head} — ${reason}`;
  return head;
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
 * `POST <ask.url>/api/ask/token {code, repo}`, `repo` (owner/name) only when there is one. Answers
 * the entry to keep, and, not kept, who signed in and where `repo` goes: `workspace` or `reason`,
 * both null when the page said nothing. Throws a `SignInError` saying why when it cannot.
 */
export async function exchangeCode({ askUrl, code, repo = null, fetch = globalThis.fetch, timeoutMs = EXCHANGE_TIMEOUT_MS }) {
  const endpoint = askEndpoint(askUrl, '/api/ask/token');
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(isText(repo) ? { code, repo } : { code }),
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
  const workspace = workspaceOf(reply.workspace);
  return {
    entry,
    login: entry.login ?? null,
    email: entry.email ?? null,
    workspace,
    reason: !workspace && isText(reply.reason) ? reply.reason : null,
  };
}
