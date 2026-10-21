// The terminal's sign-in (`omni signin`, PRD 71's spec, "The contract"), from this side:
//
//   GET  /ask/signin?port=<p>&state=<s>   a page: the galaxy's Google sign-in, coming back through
//                                         /auth/callback?next=ask-cli&port=<p>&state=<s>
//   the auth callback's ask-cli branch    a sign-in of the terminal's own, a one-time code for it,
//                                         then http://127.0.0.1:<p>/callback?state=<s>&code=<c>
//   POST /api/ask/token {code, repo?}     → {access_token, refresh_token, expires_at, login, workspace,
//                                            reason?, email?}
//   POST /api/ask/token {refresh_token}   → the same, renewed
//   POST /api/ask/token {omni_token, repo?}  → the same with refresh_token null: a kit token traded for
//                                            a short session of its maker's (PRD 1628, ./kit-token.ts)
//
// `repo` (owner/name, the checkout's repo.slug) asks where that repository's calls go (PRD 459):
// `workspace` is {slug, name}, or null with the database's `reason` (the App's install link after its
// install hint). Without `repo` (a kit from before PRD 459) `workspace` is null and there is no reason.
// `email` is there only when the account has one: GitHub lets a person keep theirs private.
//
// The terminal gets a Supabase sign-in of its own, never the browser's: with refresh-token rotation,
// two holders of one refresh token end each other's sign-in the first time both renew it. So the
// callback exchanges Google's code for a new session without keeping it in the browser's cookies,
// and hands the terminal only a one-time code: a random value, stored as its SHA-256, bound to the
// account, good once and for 2 minutes. Redeeming it renews the stored refresh token, so the tokens
// the terminal receives were never seen by the browser either. Asking needs no player row and no
// GitHub link. No account is refused for its address (PRD 459): workspace membership is the only
// gate, and the database keeps it. Nor for being in no workspace: the callback joins the person to
// their workspaces before it issues the code (joinBeforeIssue, src/data/sign-in.ts), and when the
// database still will not issue it for someone in none, the server does.
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { messageOf, propertyOf } from 'omni-loop/kit/lib/narrow.ts';
import { withInstallLink } from './auth';
import { redeemCode, type Called, type CodeRedeemer } from './cli-code.repository';
import { USER_CODE_ALPHABET, USER_CODE_LENGTH, type DevicePurpose } from './device.contract';

/** How long a one-time code works. */
export const CODE_TTL_MS = 2 * 60_000;
/** The largest body /api/ask/token accepts. */
export const MAX_TOKEN_BODY_BYTES = 8 * 1024;

const STATE = /^[A-Za-z0-9_-]{16,256}$/;
const PORT = /^[1-9][0-9]{3,4}$/;
const CODE = /^[A-Za-z0-9_-]{43}$/;
/** A repository as the kit names it: owner/name. */
const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

export type CliSignIn = { port: number; state: string };

/** The loopback port and the state `omni signin` put in its link, or null when either is missing or
 * malformed: a port from 1024 to 65535, a state of 16 to 256 URL-safe characters. */
export function readCliSignIn(params: URLSearchParams): CliSignIn | null {
  const port = params.get('port') ?? '';
  const state = params.get('state') ?? '';
  if (!PORT.test(port) || Number(port) > 65535 || !STATE.test(state)) return null;
  return { port: Number(port), state };
}

const query = (entries: Record<string, string | number>) => new URLSearchParams(Object.entries(entries).map(([k, v]) => [k, String(v)])).toString();

/** The sign-in page for the terminal, with the reason the last attempt failed when there is one. */
export const cliSignInPath = ({ port, state }: CliSignIn, error?: string) =>
  `/ask/signin?${query({ port, state, ...(error ? { signin_error: error } : {}) })}`;

/** Where Google sends the person back: the galaxy's auth callback, in its ask-cli branch. */
export const cliCallbackPath = ({ port, state }: CliSignIn) => `/auth/callback?${query({ next: 'ask-cli', port, state })}`;

/** The terminal's listener: always this computer's loopback address, whatever else the link said. */
export const loopbackUrl = ({ port, state }: CliSignIn, code: string) => `http://127.0.0.1:${port}/callback?${query({ state, code })}`;

/** 32 random bytes, URL-safe. */
export const newCode = () => randomBytes(32).toString('base64url');

/** What the code table keeps of a code: its SHA-256, in hex. */
export const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

// ── The device sign-in's way back (PRD 1660) ───────────────────────────────

const USER_CODE = new RegExp(`^[${USER_CODE_ALPHABET}]{${USER_CODE_LENGTH}}$`);

/** The user code a device link carries, as shown (XXXX-XXXX), read without case or dash; null when it
 * cannot be one. */
function readDeviceCode(raw: string | null): string | null {
  const code = (raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  return USER_CODE.test(code) ? `${code.slice(0, 4)}-${code.slice(4)}` : null;
}

/** The device page, /ask/device, with its query: `user_code`, `yes` once Yes is pressed, `done`,
 * `denied`, `signin_error`. */
export const devicePagePath = (params: Record<string, string> = {}) => {
  const search = query(params);
  return search ? `/ask/device?${search}` : '/ask/device';
};

/** Where GitHub sends the person back from the device page: the auth callback's ask-cli branch, the
 * user code in place of the loopback's port and state. */
export const deviceCallbackPath = (userCode: string, purpose: DevicePurpose = 'signin') =>
  `/auth/callback?${query({ next: 'ask-cli', device: userCode, ...(purpose === 'token' ? { purpose } : {}) })}`;

// ── The callback's ask-cli branch ───────────────────────────────────────────

/** A Supabase session, as far as the terminal's sign-in needs it. */
export type CliSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
  user: { id: string; email?: string | null; user_metadata?: { user_name?: unknown; preferred_username?: unknown } | null };
};

/** Why the database would not issue a code: the person is in no workspace (42501, ask_cli_code_issue()). */
const NO_WORKSPACE = '42501';

export type CliCallbackDeps = {
  /** Turns Google's code into a new session, kept out of the browser's cookies; null when this
   * deployment has no database. */
  exchange: ((code: string) => Promise<{ session: CliSession | null; error: { message: string } | null }>) | null;
  /** Stores the code's hash with the session's refresh token, acting as that session
   * (public.ask_cli_code_issue). */
  issue: (session: CliSession, codeHash: string) => Promise<{ error: { message: string; code?: string } | null }>;
  /** Stores the code as the server, for a person the database refused for being in no workspace:
   * the sign-in is never refused for that (PRD 459). Absent, such a sign-in is not handed over. */
  issueOutsideWorkspaces?: (session: CliSession, codeHash: string) => Promise<{ error: { message: string } | null }>;
  /** Ends a session nobody will use. Best effort. */
  revoke: (session: CliSession) => Promise<void>;
};

const UNFINISHED = 'That sign-in could not be finished. Start again from this browser.';
const NOT_HANDED = 'The sign-in could not be handed to the terminal. Run omni signin again.';

/** The provider's answer on the auth callback turned into a fresh session no browser keeps, or the
 * reason to show on the sign-in page: the provider's own refusal, or that it could not be finished. */
export async function freshSession(url: URL, exchange: CliCallbackDeps['exchange'], label: string): Promise<{ session: CliSession } | { failed: string }> {
  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (refused) return { failed: refused };
  const code = url.searchParams.get('code');
  if (!code || !exchange) return { failed: UNFINISHED };
  const { session, error } = await exchange(code);
  if (error || !session) {
    console.error(`${label}: ${error?.message ?? 'no session'}`);
    return { failed: UNFINISHED };
  }
  return { session };
}

/** Where the ask-cli branch of the auth callback sends the browser: the terminal's loopback address
 * with a fresh one-time code, or back to the sign-in page with the reason it failed. Nothing leaves
 * this site without a valid port and state. */
export async function cliSignInReturn(url: URL, origin: string, deps: CliCallbackDeps): Promise<string> {
  const signIn = readCliSignIn(url.searchParams);
  if (!signIn) return new URL('/ask/signin', origin).toString();
  const back = (error: string) => new URL(cliSignInPath(signIn, error), origin).toString();

  const fresh = await freshSession(url, deps.exchange, 'ask cli sign-in');
  if ('failed' in fresh) return back(fresh.failed);
  const code = await issueFor(fresh.session, deps);
  return code ? loopbackUrl(signIn, code) : back(NOT_HANDED);
}

/** A fresh one-time code stored for `session`, by the database or, for a person in no workspace, by
 * the server; null when it could not be stored, the session then ended. */
async function issueFor(session: CliSession, deps: CliCallbackDeps): Promise<string | null> {
  const code = newCode();
  let { error: issueError } = await deps.issue(session, hashCode(code));
  if (issueError?.code === NO_WORKSPACE && deps.issueOutsideWorkspaces) {
    ({ error: issueError } = await deps.issueOutsideWorkspaces(session, hashCode(code)));
  }
  if (!issueError) return code;
  console.error(`ask cli sign-in: ${issueError.message}`);
  await deps.revoke(session).catch(() => {});
  return null;
}

export type DeviceCallbackDeps = CliCallbackDeps & {
  /** Attaches the one-time code to the pending signin request under this user code, once; whether it
   * did. Throws when the store fails. Null when this deployment has no device sign-in. */
  approve: ((userCode: string, code: string) => Promise<boolean>) | null;
};

/** Where the device= branch of the auth callback sends the browser (PRD 1660): the same join, link and
 * one-time code as the loopback's, attached to the pending request for the terminal's next poll, then
 * the device page's done state. A request no longer pending attaches nothing and shows its expired
 * state; a refusal comes back to the device page's sign-in card with its reason. Never 127.0.0.1. */
export async function deviceSignInReturn(url: URL, origin: string, deps: DeviceCallbackDeps): Promise<string> {
  const page = (params: Record<string, string> = {}) => new URL(devicePagePath(params), origin).toString();
  const userCode = readDeviceCode(url.searchParams.get('device'));
  if (!userCode) return page();
  const back = (error: string) => page({ user_code: userCode, yes: '1', signin_error: error });

  const fresh = await freshSession(url, deps.exchange, 'ask device sign-in');
  if ('failed' in fresh) return back(fresh.failed);
  const { session } = fresh;
  const end = () => deps.revoke(session).catch(() => {});
  if (!deps.approve) {
    await end();
    return back(NOT_HANDED);
  }
  const code = await issueFor(session, deps);
  if (!code) return back(NOT_HANDED);
  let attached: boolean;
  try {
    attached = await deps.approve(userCode, code);
  } catch (error) {
    console.error(`ask device sign-in: ${messageOf(error)}`);
    await end();
    return back(NOT_HANDED);
  }
  if (!attached) {
    await end();
    return page({ user_code: userCode });
  }
  return page({ done: '1' });
}

// ── POST /api/ask/token ─────────────────────────────────────────────────────

// `data` is widened to null: the Auth server's answer is read here unparsed.
type Refreshed = { data: { session: CliSession | null } | null; error: unknown };

/** The one thing each half asks of a Supabase client acting as nobody (the anon key). */
export type TokenClient = CodeRedeemer & {
  auth: { refreshSession(current: { refresh_token: string }): Promise<Refreshed> };
};

/** A kit token's grant, as the body carried it. */
export type KitGrant = { omni_token: string; repo: string | null };

/** Trades a kit token (./kit-token.ts), on the client acting as nobody that Auth renews sessions with. */
export type KitExchange = (given: KitGrant, client: TokenClient, deps: TokenDeps) => Promise<Response>;

export type TokenDeps = {
  /** A client acting as nobody, or null when no database is configured. */
  connect: (() => TokenClient) | null;
  /** Trades `{omni_token}`; null or absent when this deployment has no key to seal kit tokens' sessions
   * with (KIT_TOKEN_KEY) or no service role to read them. */
  kit?: KitExchange | null;
  now?: () => number;
  /** Ends a session handed out by mistake. Best effort. */
  revoke?: (accessToken: string) => Promise<void>;
  /** Where a call of this person for this repository goes (repo_workspace()): the workspace, or the
   * database's reason. Absent (no service role here), nobody is told. */
  place?: ((userId: string, repo: string) => Promise<Placement>) | undefined;
  /** The App's install link, added after the database's install hint. */
  installLink?: string | null;
};

/** Where a repository's calls go: a workspace, or why none. */
export type Placement = { workspace: { slug: string; name: string } | null; reason: string | null };

/** An answer of the token exchange: never cached. */
export const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
export const refuse = (status: number, error: string) => reply(status, { error });

const CODE_INVALID = 'This sign-in code is not valid: it was used already, or never issued. Run omni signin again.';
const CODE_EXPIRED = 'This sign-in code has expired. Run omni signin again.';
const CODE_ELSEWHERE = 'This sign-in code was issued to another account. Run omni signin again.';
const REFRESH_REFUSED = 'This sign-in is not valid any more. Run omni signin again.';
export const AUTH_DOWN = 'The sign-in service could not be reached. Try again.';
const KIT_NOT_SET_UP = 'Kit tokens are not set up here: this deployment has no key to keep them with.';

/** A failure of the Auth server itself (unreachable: status 0, or 5xx), not a verdict on a token. */
function authDown(error: unknown) {
  const status = propertyOf(error, 'status');
  return typeof status === 'number' && (status === 0 || status >= 500);
}

export const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

type Grant = ({ code: string } | { refresh_token: string } | { omni_token: string }) & { repo: string | null };

/** `{code}`, `{refresh_token}` or `{omni_token}`, exactly one, maybe with `repo`, or the Response that
 * refuses the body. */
async function grant(request: Request): Promise<Grant | Response> {
  const tooLarge = () => refuse(413, `A call to /api/ask/token carries ${MAX_TOKEN_BODY_BYTES / 1024} KiB at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_TOKEN_BODY_BYTES) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_TOKEN_BODY_BYTES) return tooLarge();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const wrong = () => refuse(400, 'The body must be {"code": "…"}, {"refresh_token": "…"} or {"omni_token": "…"}, with "repo": "owner/name" if you like.');
  if (!isRecord(body)) return wrong();
  const { code, refresh_token: refreshToken, omni_token: omniToken, repo, ...rest } = body;
  const given = [code, refreshToken, omniToken].filter((value) => value !== undefined);
  if (Object.keys(rest).length > 0 || given.length !== 1) return wrong();
  if (repo !== undefined && (typeof repo !== 'string' || !REPO.test(repo))) return wrong();
  const named = { repo: typeof repo === 'string' ? repo : null };
  if (code !== undefined) return isText(code) ? { code, ...named } : wrong();
  if (omniToken !== undefined) return isText(omniToken) ? { omni_token: omniToken, ...named } : wrong();
  return isText(refreshToken) ? { refresh_token: refreshToken, ...named } : wrong();
}

/** The account's GitHub login, as Supabase recorded it from GitHub, or null. */
export function loginOf(user: CliSession['user']): string | null {
  const meta = user.user_metadata ?? {};
  const login = meta.user_name ?? meta.preferred_username;
  return isText(login) ? login : null;
}

/** Where `repo`'s calls go for this person, never failing the sign-in: nothing is said when it
 * cannot be looked up. */
export async function placement(deps: TokenDeps, userId: string, repo: string | null): Promise<Placement> {
  const none: Placement = { workspace: null, reason: null };
  if (!repo || !deps.place) return none;
  try {
    const placed = await deps.place(userId, repo);
    if (placed.workspace) return { workspace: { slug: placed.workspace.slug, name: placed.workspace.name }, reason: null };
    return { workspace: null, reason: placed.reason ? withInstallLink(placed.reason, deps.installLink) : null };
  } catch (error) {
    console.error(`ask token: where ${repo} goes: ${error instanceof Error ? error.message : String(error)}`);
    return none;
  }
}

/** The code's row, redeemed (and so deleted), or null for an unknown or used code. */
async function redeem(client: TokenClient, code: string) {
  const { data, error }: Called = await redeemCode(client, hashCode(code));
  if (error) throw Object.assign(new Error(`ask_cli_code_redeem: ${error.message}`), { name: 'AskCodeStoreError' });
  const row: unknown = Array.isArray(data) ? data[0] : data;
  const owner = propertyOf(row, 'owner');
  const refreshToken = propertyOf(row, 'refresh_token');
  const expiresAt = propertyOf(row, 'expires_at');
  if (!isText(owner) || !isText(refreshToken) || !isText(expiresAt)) return null;
  return { owner, refresh_token: refreshToken, expires_at: Date.parse(expiresAt) };
}

/** A refresh token renewed by Auth: the new session; `down` when Auth itself failed; or why Auth
 * refused it. */
export async function renewSession(client: TokenClient, refreshToken: string): Promise<CliSession | 'down' | `refused: ${string}`> {
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (authDown(error)) return 'down';
  const session = data?.session;
  if (error || !session || !isText(session.access_token) || !isText(session.refresh_token)) {
    const message = propertyOf(error, 'message');
    return `refused: ${typeof message === 'string' ? message : 'no session'}`;
  }
  return session;
}

/** The contract's token exchange: a one-time code or a refresh token in, the account's tokens out,
 * with the GitHub login and where `repo` goes. A sign-in is never refused for where that is.
 * 400 for a body of any other shape, 413 when too large; 401 for a code unknown, used, expired or
 * issued to another account, or a refresh token refused; 503 with no database
 * or Auth down; 500 when the code table fails. A kit token goes to `deps.kit` (./kit-token.ts), and
 * answers 503 when this deployment cannot trade one. */
export async function exchangeToken(request: Request, deps: TokenDeps): Promise<Response> {
  const given = await grant(request);
  if (given instanceof Response) return given;
  if (!deps.connect) return refuse(503, 'Ask mode is not available here: this deployment has no database.');
  const client = deps.connect();
  const now = deps.now ?? Date.now;
  if ('omni_token' in given) return deps.kit ? deps.kit(given, client, deps) : refuse(503, KIT_NOT_SET_UP);

  let refreshToken: string;
  let owner: string | null = null;
  if ('code' in given) {
    if (!CODE.test(given.code)) return refuse(401, CODE_INVALID);
    let row;
    try {
      row = await redeem(client, given.code);
    } catch (error) {
      console.error(`ask token: ${messageOf(error)}`);
      return refuse(500, 'The ask database could not answer. Try again.');
    }
    if (!row) return refuse(401, CODE_INVALID);
    if (!(row.expires_at > now())) return refuse(401, CODE_EXPIRED);
    refreshToken = row.refresh_token;
    owner = row.owner;
  } else {
    refreshToken = given.refresh_token;
  }

  const renewed = await renewSession(client, refreshToken);
  if (renewed === 'down') return refuse(503, AUTH_DOWN);
  if (typeof renewed === 'string') return refuse(401, REFRESH_REFUSED);
  const session = renewed;
  const end = () => deps.revoke?.(session.access_token).catch(() => {});
  if (owner !== null && session.user.id !== owner) {
    await end();
    return refuse(401, CODE_ELSEWHERE);
  }
  const { workspace, reason } = await placement(deps, session.user.id, given.repo);
  return reply(200, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: typeof session.expires_at === 'number' ? session.expires_at : null,
    login: loginOf(session.user),
    workspace,
    ...(reason ? { reason } : {}),
    ...(isText(session.user.email) ? { email: session.user.email } : {}),
  });
}
