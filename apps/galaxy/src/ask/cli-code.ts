// The terminal's sign-in (`omni signin`, PRD 71's spec, "The contract"), from this side:
//
//   GET  /ask/signin?port=<p>&state=<s>   a page: the galaxy's Google sign-in, coming back through
//                                         /auth/callback?next=ask-cli&port=<p>&state=<s>
//   the auth callback's ask-cli branch    a sign-in of the terminal's own, a one-time code for it,
//                                         then http://127.0.0.1:<p>/callback?state=<s>&code=<c>
//   POST /api/ask/token {code}            → {access_token, refresh_token, expires_at, email}
//   POST /api/ask/token {refresh_token}   → the same, renewed
//
// The terminal gets a Supabase sign-in of its own, never the browser's: with refresh-token rotation,
// two holders of one refresh token end each other's sign-in the first time both renew it. So the
// callback exchanges Google's code for a new session without keeping it in the browser's cookies,
// and hands the terminal only a one-time code: a random value, stored as its SHA-256, bound to the
// account, good once and for 2 minutes. Redeeming it renews the stored refresh token, so the tokens
// the terminal receives were never seen by the browser either. Asking needs no player row and no
// GitHub link. No account is refused for its address (PRD 459): workspace membership is the only
// gate, and the database keeps it.
import { createHash, randomBytes } from 'node:crypto';

/** How long a one-time code works. */
export const CODE_TTL_MS = 2 * 60_000;
/** The largest body /api/ask/token accepts. */
export const MAX_TOKEN_BODY_BYTES = 8 * 1024;

const STATE = /^[A-Za-z0-9_-]{16,256}$/;
const PORT = /^[1-9][0-9]{3,4}$/;
const CODE = /^[A-Za-z0-9_-]{43}$/;

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

// ── The callback's ask-cli branch ───────────────────────────────────────────

/** A Supabase session, as far as the terminal's sign-in needs it. */
export type CliSession = { access_token: string; refresh_token: string; expires_at?: number | null; user: { id: string; email?: string | null } };

export type CliCallbackDeps = {
  /** Turns Google's code into a new session, kept out of the browser's cookies; null when this
   * deployment has no database. */
  exchange: ((code: string) => Promise<{ session: CliSession | null; error: { message: string } | null }>) | null;
  /** Stores the code's hash with the session's refresh token, acting as that session
   * (public.ask_cli_code_issue). */
  issue: (session: CliSession, codeHash: string) => Promise<{ error: { message: string } | null }>;
  /** Ends a session nobody will use. Best effort. */
  revoke: (session: CliSession) => Promise<void>;
};

const UNFINISHED = 'That sign-in could not be finished. Start again from this browser.';
const NOT_HANDED = 'The sign-in could not be handed to the terminal. Run omni signin again.';

/** Where the ask-cli branch of the auth callback sends the browser: the terminal's loopback address
 * with a fresh one-time code, or back to the sign-in page with the reason it failed. Nothing leaves
 * this site without a valid port and state. */
export async function cliSignInReturn(url: URL, origin: string, deps: CliCallbackDeps): Promise<string> {
  const signIn = readCliSignIn(url.searchParams);
  if (!signIn) return new URL('/ask/signin', origin).toString();
  const back = (error: string) => new URL(cliSignInPath(signIn, error), origin).toString();

  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (refused) return back(refused);
  const googleCode = url.searchParams.get('code');
  if (!googleCode || !deps.exchange) return back(UNFINISHED);

  const { session, error } = await deps.exchange(googleCode);
  if (error || !session) {
    console.error(`ask cli sign-in: ${error?.message ?? 'no session'}`);
    return back(UNFINISHED);
  }
  const end = () => deps.revoke(session).catch(() => {});
  const code = newCode();
  const { error: issueError } = await deps.issue(session, hashCode(code));
  if (issueError) {
    console.error(`ask cli sign-in: ${issueError.message}`);
    await end();
    return back(NOT_HANDED);
  }
  return loopbackUrl(signIn, code);
}

// ── POST /api/ask/token ─────────────────────────────────────────────────────

type Refreshed = { data: { session: CliSession | null }; error: unknown };
type Called = { data: unknown; error: { message: string; code?: string } | null };

/** The one thing each half asks of a Supabase client acting as nobody (the anon key). */
export type TokenClient = {
  auth: { refreshSession(current: { refresh_token: string }): Promise<Refreshed> };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Called>;
};

export type TokenDeps = {
  /** A client acting as nobody, or null when no database is configured. */
  connect: (() => TokenClient) | null;
  now?: () => number;
  /** Ends a session handed out by mistake. Best effort. */
  revoke?: (accessToken: string) => Promise<void>;
};

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string) => reply(status, { error });

const CODE_INVALID = 'This sign-in code is not valid: it was used already, or never issued. Run omni signin again.';
const CODE_EXPIRED = 'This sign-in code has expired. Run omni signin again.';
const CODE_ELSEWHERE = 'This sign-in code was issued to another account. Run omni signin again.';
const REFRESH_REFUSED = 'This sign-in is not valid any more. Run omni signin again.';
const AUTH_DOWN = 'The sign-in service could not be reached. Try again.';

/** A failure of the Auth server itself (unreachable: status 0, or 5xx), not a verdict on a token. */
function authDown(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && (status === 0 || status >= 500);
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** `{code}` or `{refresh_token}`, exactly one, or the Response that refuses the body. */
async function grant(request: Request): Promise<{ code: string } | { refresh_token: string } | Response> {
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
  const wrong = () => refuse(400, 'The body must be {"code": "…"} or {"refresh_token": "…"}.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) return wrong();
  const { code, refresh_token: refreshToken, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || (code === undefined) === (refreshToken === undefined)) return wrong();
  if (code !== undefined) return isText(code) ? { code } : wrong();
  return isText(refreshToken) ? { refresh_token: refreshToken } : wrong();
}

/** The code's row, redeemed (and so deleted), or null for an unknown or used code. */
async function redeem(client: TokenClient, code: string) {
  const { data, error } = await client.rpc('ask_cli_code_redeem', { p_code_hash: hashCode(code) });
  if (error) throw Object.assign(new Error(`ask_cli_code_redeem: ${error.message}`), { name: 'AskCodeStoreError' });
  const row = (Array.isArray(data) ? data[0] : data) as { owner?: unknown; refresh_token?: unknown; expires_at?: unknown } | undefined | null;
  if (!row || !isText(row.owner) || !isText(row.refresh_token) || !isText(row.expires_at)) return null;
  return { owner: row.owner, refresh_token: row.refresh_token, expires_at: Date.parse(row.expires_at) };
}

/** The contract's token exchange: a one-time code or a refresh token in, the account's tokens out.
 * 400 for a body of any other shape, 413 when too large; 401 for a code unknown, used, expired or
 * issued to another account, or a refresh token refused; 503 with no database
 * or Auth down; 500 when the code table fails. */
export async function exchangeToken(request: Request, deps: TokenDeps): Promise<Response> {
  const given = await grant(request);
  if (given instanceof Response) return given;
  if (!deps.connect) return refuse(503, 'Ask mode is not available here: this deployment has no database.');
  const client = deps.connect();
  const now = deps.now ?? Date.now;

  let refreshToken: string;
  let owner: string | null = null;
  if ('code' in given) {
    if (!CODE.test(given.code)) return refuse(401, CODE_INVALID);
    let row;
    try {
      row = await redeem(client, given.code);
    } catch (error) {
      console.error(`ask token: ${(error as Error).message}`);
      return refuse(500, 'The ask database could not answer. Try again.');
    }
    if (!row) return refuse(401, CODE_INVALID);
    if (!(row.expires_at > now())) return refuse(401, CODE_EXPIRED);
    refreshToken = row.refresh_token;
    owner = row.owner;
  } else {
    refreshToken = given.refresh_token;
  }

  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (authDown(error)) return refuse(503, AUTH_DOWN);
  const session = data?.session;
  if (error || !session || !isText(session.access_token) || !isText(session.refresh_token)) return refuse(401, REFRESH_REFUSED);
  const end = () => deps.revoke?.(session.access_token).catch(() => {});
  if (owner !== null && session.user.id !== owner) {
    await end();
    return refuse(401, CODE_ELSEWHERE);
  }
  return reply(200, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: typeof session.expires_at === 'number' ? session.expires_at : null,
    email: session.user.email,
  });
}
