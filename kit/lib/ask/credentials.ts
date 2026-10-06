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
import { homeTokens } from './client-tokens.ts';
import { askClient, type Fetch, type TokenStore } from './client.ts';
import { jsonObject, textOrNull, TokenReplySchema } from './schema.ts';
import type { Tokens } from './schema.ts';

/** The entry a sign-in keeps for a host: both tokens, their expiry, and who signed in when known. */
export type TokenEntry = { access_token: string; refresh_token: string; expires_at: number | null; email?: string; login?: string };

const FILE = ['.config', 'omni', 'credentials.json'];

/** How long the token exchange may take. */
export const EXCHANGE_TIMEOUT_MS = 10_000;

export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignInError';
  }
}

/** The key a sign-in is kept under: the host of `ask.url`, with its port. */
export const credentialsHost = (askUrl: string): string => new URL(askUrl).host;

/** The ask client of `askUrl`, with the person's sign-in for its host (`tokens`, else the one in
 * `home`), or null when there is none. */
export function signedInClient({ askUrl, tokens, home, fetch, callMs }: {
  askUrl: string;
  tokens: TokenStore | undefined;
  home: string | undefined;
  fetch: Fetch;
  callMs: number | undefined;
}): ReturnType<typeof askClient> | null {
  const host = credentialsHost(askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  if (!store.read(host)) return null;
  return askClient({ baseUrl: askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) });
}

/** Where a call of the contract goes: a path under `ask.url`, which may itself carry a path. */
export const askEndpoint = (askUrl: string, path: string): string => `${askUrl.replace(/\/+$/, '')}${path}`;

const isText = (value: unknown): value is string => textOrNull(value) !== null;

/**
 * The entry kept for a host, from the token exchange's reply: the two tokens and their expiry, with
 * the email and the GitHub login when the reply has them, or `null` when it lacks a token.
 */
export function tokenEntry(reply: unknown): TokenEntry | null {
  const value = jsonObject(reply);
  const tokens = TokenReplySchema.safeParse(value);
  if (!value || !tokens.success) return null;
  const { access_token, refresh_token } = tokens.data;
  const { expires_at, email, login } = value;
  return {
    access_token,
    refresh_token,
    expires_at: typeof expires_at === 'number' ? expires_at : null,
    ...(isText(email) ? { email } : {}),
    ...(isText(login) ? { login } : {}),
  };
}

/** The workspace a reply names, as `{slug, name}`, or `null`. */
function workspaceOf(value: unknown): { slug: string | null; name: string } | null {
  // A list is an object too, as it always was here: its `name` is what decides.
  if (typeof value !== 'object' || value === null || !('name' in value) || !isText(value.name)) return null;
  return { slug: 'slug' in value && isText(value.slug) ? value.slug : null, name: value.name };
}

/**
 * The line a sign-in ends on (PRD 459): who signed in and, when the page said, where `repo`'s calls
 * go — to a workspace, or the page's reason why none (which carries the App's install link when no
 * workspace owns it yet). All of them are a sign-in that worked.
 */
export function signedInLine({ login, email, repo, workspace, reason }: {
  login?: string | null;
  email?: string | null;
  repo?: string | null;
  workspace?: { slug?: string | null; name: string } | null;
  reason?: string | null;
} = {}): string {
  const who = isText(login) ? login : isText(email) ? email : null;
  const head = who ? `signed in as ${who}` : 'signed in';
  if (!isText(repo)) return head;
  if (workspace && isText(workspace.name)) return `${head} — ${repo} goes to ${workspace.name}`;
  if (isText(reason)) return `${head} — ${reason}`;
  return head;
}

export function credentials({ home = homedir() }: { home?: string | undefined } = {}): TokenStore & { file: string; remove(host: string): boolean } {
  const file = join(home, ...FILE);
  const tokens = homeTokens({ home });
  return {
    file,
    /** The host's entry, or `null`. */
    read: (host: string): Tokens | null => tokens.read(host),
    /** Keeps the host's entry, and every other host's, at mode 0600. */
    write: (host: string, entry: Tokens): void => {
      tokens.write(host, entry);
    },
    /** Forgets the host; `true` when it had an entry. The file goes with its last host. */
    remove(host: string): boolean {
      let all: Record<string, unknown> | null;
      try {
        all = jsonObject(JSON.parse(readFileSync(file, 'utf8')));
      } catch {
        return false;
      }
      if (!all || !Object.hasOwn(all, host)) return false;
      Reflect.deleteProperty(all, host);
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

async function replyOf(response: Response): Promise<unknown> {
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
export async function exchangeCode({ askUrl, code, repo = null, fetch = globalThis.fetch, timeoutMs = EXCHANGE_TIMEOUT_MS }: {
  askUrl: string;
  code: string;
  repo?: string | null;
  fetch?: Fetch;
  timeoutMs?: number;
}): Promise<{ entry: TokenEntry; login: string | null; email: string | null; workspace: { slug: string | null; name: string } | null; reason: string | null }> {
  const endpoint = askEndpoint(askUrl, '/api/ask/token');
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(isText(repo) ? { code, repo } : { code }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';
    const why = timedOut ? 'it did not answer in time' : 'it is unreachable';
    throw new SignInError(`could not reach ${credentialsHost(askUrl)} to finish the sign-in: ${why}.`);
  }
  const reply = jsonObject(await replyOf(response));
  if (!response.ok) {
    const reason = isText(reply?.error) ? reply.error : `HTTP ${response.status}`;
    throw new SignInError(`the sign-in was refused: ${reason}`);
  }
  const entry = tokenEntry(reply);
  if (!entry) throw new SignInError('the sign-in server answered with no tokens.');
  const workspace = workspaceOf(reply?.workspace);
  return {
    entry,
    login: entry.login ?? null,
    email: entry.email ?? null,
    workspace,
    reason: !workspace && isText(reply?.reason) ? reply.reason : null,
  };
}
