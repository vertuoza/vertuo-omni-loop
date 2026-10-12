// The kit token (PRD 1628, spec sections 1 to 3; 20261204090000_kit_tokens.sql): a personal token that
// signs the `omni` command in where no browser opens, read from OMNI_TOKEN in a cloud session.
//
//   GET /ask/signin?purpose=token&name=<n>&days=<30|90|365>[&workspace=<slug>]
//        &port=<p>&state=<s>               `omni setup-token`: the token goes back to the loopback
//        &back=/app/…                       Make a token on the profile page: back to that page
//   the auth callback's ask-cli branch, with purpose=token: a fresh sign-in of its own (as `omni signin`
//        gets), whose refresh token is sealed with the server's key and stored in the token's row; the
//        token itself, `omk_` and 32 random bytes in base64url, is stored as its SHA-256 and last four,
//        and handed back once:
//          http://127.0.0.1:<p>/callback?state=<s>&token=<omk_…>&expires_at=<ISO date>
//          or the page, with the token kept for it in a cookie that POST /api/ask/token/made reads once
//   POST /api/ask/token {omni_token, repo?} → {access_token, refresh_token: null, expires_at, login,
//        workspace, reason?, email?}, as the other two bodies answer (./cli-code.ts), or 401
//        {error, reason}: `revoked`, `expired` (with expires_at), `not-a-member` (with login and
//        workspace) or `unknown`
//
// Only the server ever holds the token's refresh token: it renews it on each exchange and writes it
// back, so any number of containers share one token and rotation never ends anyone's sign-in
// (decision 3). An exchange claims the token under a lease first (the database's stand-in for a row
// lock across two calls); a second exchange arriving meanwhile waits for it, then renews after it.
// The token is never logged, never answered back by the exchange, and never in a URL but the
// loopback's.
import 'server-only';
import { z } from 'zod';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { openSecret, sealSecret } from '../jev/secret-box';
import {
  AUTH_DOWN, freshSession, hashCode, isText, loginOf, newCode, placement, readCliSignIn, refuse, renewSession, reply,
  type CliCallbackDeps, type CliSession, type CliSignIn, type KitExchange, type TokenClient,
} from './cli-code';

/** A kit token: `omk_` and 32 random bytes, base64url, stored as its SHA-256 as a code is. */
export const KIT_TOKEN = /^omk_[A-Za-z0-9_-]{43}$/;
/** The expiries a kit token may have, in days; 90 unless asked. */
const KIT_DAYS = [30, 90, 365] as const;
export type KitDays = (typeof KIT_DAYS)[number];
const DEFAULT_DAYS: KitDays = 90;

/** Seals and opens a token's session with the server's key (KIT_TOKEN_KEY); `open` throws on a seal it
 * cannot open. */
export type KitBox = { seal(plain: string): string; open(sealed: string): string };

/** The box under `key` (32 bytes): AES-256-GCM with a fresh iv each time (../jev/secret-box.ts), stored
 * as `<iv>.<ciphertext and tag>`, both base64. Null without a key: kit tokens are off here. */
export function kitBox(key: Buffer | null): KitBox | null {
  if (!key) return null;
  return {
    seal(plain) {
      const { iv, ciphertext } = sealSecret(plain, key);
      return `${iv}.${ciphertext}`;
    },
    open(sealed) {
      const [iv, ciphertext, ...rest] = sealed.split('.');
      if (!iv || !ciphertext || rest.length > 0) throw new Error('The stored session is malformed.');
      return openSecret({ iv, ciphertext }, key);
    },
  };
}

// ── The round trip that makes one ───────────────────────────────────────────

/** Where a made token goes back: the terminal's loopback listener, or a page of the app. */
export type TokenTarget = CliSignIn | { back: string };

/** A token asked for: its name, its expiry, the workspace it acts in (its slug; null for the person's
 * first one), and where it goes back. */
export type TokenRequest = { name: string; days: KitDays; workspace: string | null; to: TokenTarget };

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** A page of the app, same site, with no query, no dot segment and no double slash. */
const BACK = /^\/app(?:\/[A-Za-z0-9_-]+)+$/;

/** `name` trimmed, 1 to 40 characters on one line, or null. */
function nameOf(raw: string | null, today: Date): string | null {
  const name = (raw ?? '').trim();
  if (name === '') return `terminal ${today.toISOString().slice(0, 10)}`;
  const control = Array.from({ length: name.length }, (_, at) => name.charCodeAt(at)).some((code) => code < 32 || code === 127);
  return name.length <= 40 && !control ? name : null;
}

/** The token a round trip asks for, or null when anything in it is missing or malformed: `purpose=token`;
 * a name of 1 to 40 characters (default `terminal <today>`); 30, 90 or 365 days (default 90); a
 * workspace's slug, or none; and exactly one way back, a valid loopback port and state or a page of
 * the app. */
export function readTokenRequest(params: URLSearchParams, today: Date): TokenRequest | null {
  if (params.get('purpose') !== 'token') return null;
  const name = nameOf(params.get('name'), today);
  const rawDays = params.get('days');
  const days = rawDays === null ? DEFAULT_DAYS : KIT_DAYS.find((d) => String(d) === rawDays);
  const workspace = params.get('workspace');
  if (!name || !days || (workspace !== null && !SLUG.test(workspace))) return null;
  const loopback = readCliSignIn(params);
  const back = params.get('back');
  const asksLoopback = params.has('port') || params.has('state');
  let to: TokenTarget;
  if (back !== null) {
    if (asksLoopback || !BACK.test(back)) return null;
    to = { back };
  } else if (loopback) {
    to = loopback;
  } else {
    return null;
  }
  return { name, days, workspace, to };
}

const query = (entries: Record<string, string | number | null>) =>
  new URLSearchParams(Object.entries(entries).flatMap(([k, v]) => (v === null ? [] : [[k, String(v)]]))).toString();

const requestQuery = ({ name, days, workspace, to }: TokenRequest) => ({
  purpose: 'token', name, days, workspace,
  ...('back' in to ? { back: to.back } : { port: to.port, state: to.state }),
});

/** The sign-in page for a token, with the reason the last attempt failed when there is one. */
export const tokenSignInPath = (request: TokenRequest, error?: string) =>
  `/ask/signin?${query({ ...requestQuery(request), ...(error ? { signin_error: error } : {}) })}`;

/** Where GitHub sends the person back: the auth callback's ask-cli branch, for a token. */
export const tokenCallbackPath = (request: TokenRequest) => `/auth/callback?${query({ next: 'ask-cli', ...requestQuery(request) })}`;

/** The terminal's listener, for a token: always this computer's loopback address, as for a code. */
const tokenLoopbackUrl = ({ port, state }: CliSignIn, token: string, expiresAt: string) =>
  `http://127.0.0.1:${port}/callback?${query({ state, token, expires_at: expiresAt })}`;

/** A token just made, for the page that asked for it. */
export type MadeToken = { token: string; name: string; expiresAt: string };

/** What the callback does next: send the browser to `location`, keeping `made` for the page (in the
 * made-token cookie) when the token goes back to one. */
export type TokenReturn = { location: string; made: MadeToken | null };

/** The row a round trip makes, as kit_token_make() takes it. */
export type KitRow = { workspace: string | null; name: string; hash: string; lastFour: string; days: KitDays; session: string };

export type KitMakeDeps = {
  /** Turns GitHub's code into a fresh session no browser keeps (as `omni signin`'s). */
  exchange: CliCallbackDeps['exchange'];
  /** Joins the person to their GitHub orgs' workspaces first, as every sign-in does. Best effort. */
  join?: (session: CliSession) => Promise<unknown>;
  /** Makes the row acting as `session` (kit_token_make): when it expires, or the database's refusal. */
  make: (session: CliSession, row: KitRow) => Promise<{ expiresAt: string | null; error: { message: string; code?: string } | null }>;
  /** Seals the session; null when this deployment has no key. */
  box: KitBox | null;
  /** Ends a session nobody will use. Best effort. */
  revoke: (session: CliSession) => Promise<void>;
};

const NOT_SET_UP = 'Terminal tokens are not set up on this deployment.';
const NOT_MADE = 'The token could not be made. Try again.';
/** The database's refusals whose words are for the person: no workspace, a bad value, the 20 limit. */
const SAID_BY_DATABASE = new Set(['42501', '22023', '54000']);

/** The token made for `session`, its session sealed in its row; or the reason it was not. */
async function makeToken(session: CliSession, request: TokenRequest, deps: KitMakeDeps): Promise<MadeToken | { failed: string }> {
  if (!deps.box) return { failed: NOT_SET_UP };
  await deps.join?.(session).catch((error: unknown) => {
    console.error(`kit token sign-in: joining workspaces: ${messageOf(error)}`);
  });
  const token = `omk_${newCode()}`;
  const { expiresAt, error } = await deps.make(session, {
    workspace: request.workspace, name: request.name, hash: hashCode(token), lastFour: token.slice(-4), days: request.days,
    session: deps.box.seal(session.refresh_token),
  });
  if (error || !expiresAt) {
    console.error(`kit token sign-in: kit_token_make: ${error?.message ?? 'no expiry'}`);
    return { failed: error?.code && SAID_BY_DATABASE.has(error.code) ? error.message : NOT_MADE };
  }
  return { token, name: request.name, expiresAt: new Date(expiresAt).toISOString() };
}

/** The callback's token branch: the fresh sign-in becomes a kit token, handed back once to the loopback
 * or to the page, or the browser goes back to the sign-in page with the reason. The fresh session
 * itself lives on only sealed in the token's row: whatever fails, it is ended. */
export async function tokenSignInReturn(url: URL, origin: string, deps: KitMakeDeps, today = new Date()): Promise<TokenReturn> {
  const request = readTokenRequest(url.searchParams, today);
  if (!request) return { location: new URL('/ask/signin', origin).toString(), made: null };
  const back = (error: string): TokenReturn => ({ location: new URL(tokenSignInPath(request, error), origin).toString(), made: null });

  const fresh = await freshSession(url, deps.exchange, 'kit token sign-in');
  if ('failed' in fresh) return back(fresh.failed);
  const made = await makeToken(fresh.session, request, deps);
  if ('failed' in made) {
    await deps.revoke(fresh.session).catch(() => {});
    return back(made.failed);
  }
  if ('back' in request.to) return { location: new URL(request.to.back, origin).toString(), made };
  return { location: tokenLoopbackUrl(request.to, made.token, made.expiresAt), made: null };
}

// ── The token shown once on the page ────────────────────────────────────────

/** The cookie that keeps a made token for the page that asked for it, five minutes at most. */
export const MADE_COOKIE = 'omni_made_token';
const MADE_PATH = '/api/ask/token/made';
const MadeSchema = z.object({ token: z.string().regex(KIT_TOKEN), name: z.string().min(1).max(40), expiresAt: z.iso.datetime() });

/** The made-token cookie: readable by no script, sent to the made-token route only. */
export function madeCookie(made: MadeToken, secure: boolean) {
  return {
    name: MADE_COOKIE,
    value: Buffer.from(JSON.stringify(made)).toString('base64url'),
    options: { httpOnly: true, secure, sameSite: 'lax' as const, path: MADE_PATH, maxAge: 300 },
  };
}

/** The token a made-token cookie keeps, or null. */
export function readMadeCookie(value: string | undefined): MadeToken | null {
  if (!value) return null;
  try {
    const parsed = MadeSchema.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** POST /api/ask/token/made: the token kept for this browser, once (the route clears the cookie), or 404. */
export function takeMadeToken(cookie: string | undefined): Response {
  const made = readMadeCookie(cookie);
  if (!made) return refuse(404, 'No token is waiting to be shown here: tokens are shown once.');
  return reply(200, { token: made.token, name: made.name, expires_at: made.expiresAt });
}

/** Where the made-token cookie lives, for the route that clears it. */
export const madeCookiePath = MADE_PATH;

// ── The exchange ────────────────────────────────────────────────────────────

/** The token store's calls (kit_token_claim, _renewed, _release), as the service role. A claim answers
 * the database's jsonb unparsed; each throws when the database fails. */
export type KitStore = {
  claim(hash: string): Promise<unknown>;
  renewed(id: string, lease: string, sealed: string): Promise<boolean>;
  release(id: string, lease: string): Promise<void>;
};

export type KitExchangeDeps = {
  store: KitStore;
  box: KitBox;
  /** Waits between two claims of a token another exchange holds. */
  sleep?: (ms: number) => Promise<void>;
};

const WORKSPACE = z.object({ slug: z.string(), name: z.string() });
const Claim = z.discriminatedUnion('state', [
  z.object({ state: z.literal('ok'), id: z.string(), owner: z.string(), session: z.string(), lease: z.string(), expiresAt: z.string() }),
  z.object({ state: z.literal('busy') }),
  z.object({ state: z.literal('unknown') }),
  z.object({ state: z.literal('revoked') }),
  z.object({ state: z.literal('expired'), expiresAt: z.string() }),
  z.object({ state: z.literal('not-a-member'), login: z.string().nullable(), workspace: WORKSPACE }),
]);
type Claimed = z.infer<typeof Claim>;

/** How long a second exchange waits for the first, at most: 40 claims, 250 ms apart. */
const CLAIMS = 40;
const CLAIM_GAP_MS = 250;
/** An access token answered lives an hour at most. */
const HOUR_S = 3600;

const AGAIN = 'make a new one with omni setup-token or on your profile page.';
const UNKNOWN = `This token is not known here: ${AGAIN}`;
const REVOKED = `This token was revoked: ${AGAIN}`;
const BUSY = 'This token is being renewed by another session. Try again.';
const STORE_DOWN = 'The token store could not answer. Try again.';

const seconds = (ms: number) => Math.floor(ms / 1000);
const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** The 401 for a token that does not work, with its reason and what the kit needs to say it. */
function refusal(claimed: Exclude<Claimed, { state: 'ok' } | { state: 'busy' }>): Response {
  switch (claimed.state) {
    case 'unknown':
      return reply(401, { error: UNKNOWN, reason: 'unknown' });
    case 'revoked':
      return reply(401, { error: REVOKED, reason: 'revoked' });
    case 'expired':
      return reply(401, { error: `This token expired on ${day(claimed.expiresAt)}: ${AGAIN}`, reason: 'expired', expires_at: seconds(Date.parse(claimed.expiresAt)) });
    case 'not-a-member':
      return reply(401, {
        error: `${claimed.login ?? 'Its maker'} is no longer a member of ${claimed.workspace.name}: this token stopped with them.`,
        reason: 'not-a-member', login: claimed.login, workspace: claimed.workspace,
      });
  }
}


type Held = Extract<Claimed, { state: 'ok' }>;
type Sleep = (ms: number) => Promise<void>;
const nap: Sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The token claimed under a lease, waiting for an exchange that holds it; or the answer that ends this
 * one: 401 for a token that does not work, 503 when another exchange holds it too long, 500 when the
 * store fails. */
async function claim(kit: KitExchangeDeps, hash: string): Promise<Held | Response> {
  const sleep = kit.sleep ?? nap;
  try {
    for (let attempt = 0; attempt < CLAIMS; attempt += 1) {
      if (attempt > 0) await sleep(CLAIM_GAP_MS);
      const claimed = Claim.parse(await kit.store.claim(hash));
      if (claimed.state === 'ok') return claimed;
      if (claimed.state !== 'busy') return refusal(claimed);
    }
  } catch (error) {
    console.error(`ask token: kit token claim: ${messageOf(error)}`);
    return refuse(500, STORE_DOWN);
  }
  return refuse(503, BUSY);
}

/** The held token's session, renewed by Auth as the server; or the answer that ends the exchange. The
 * caller releases the lease either way it fails. */
async function renew(kit: KitExchangeDeps, held: Held, client: TokenClient): Promise<CliSession | Response> {
  let refreshToken: string;
  try {
    refreshToken = kit.box.open(held.session);
  } catch (error) {
    console.error(`ask token: a kit token's session could not be opened: ${messageOf(error)}`);
    return refusal({ state: 'revoked' });
  }
  const renewed = await renewSession(client, refreshToken);
  if (renewed === 'down') return refuse(503, AUTH_DOWN);
  if (typeof renewed === 'string') {
    console.error(`ask token: a kit token's session could not be renewed: ${renewed}`);
    return refusal({ state: 'revoked' });
  }
  return renewed;
}

/** Writes the renewed session back under the lease, or the answer that ends the exchange: 401 when the
 * token was revoked meanwhile, 500 when the store fails. */
async function writeBack(kit: KitExchangeDeps, held: Held, session: CliSession): Promise<Response | null> {
  if (session.user.id !== held.owner) return refusal({ state: 'unknown' });
  try {
    const written = await kit.store.renewed(held.id, held.lease, kit.box.seal(session.refresh_token));
    return written ? null : refusal({ state: 'revoked' });
  } catch (error) {
    console.error(`ask token: kit token renewed: ${messageOf(error)}`);
    return refuse(500, STORE_DOWN);
  }
}

/** When the answered access token stops being traded for: its own expiry, an hour at most, and never
 * past the token's. */
function expiryOf(session: CliSession, held: Held, nowMs: number): number {
  const nowS = seconds(nowMs);
  const own = typeof session.expires_at === 'number' ? session.expires_at : nowS + HOUR_S;
  return Math.min(own, nowS + HOUR_S, seconds(Date.parse(held.expiresAt)));
}

/** `/api/ask/token {omni_token}`: claims the token, renews its stored session as the server, writes the
 * new one back and answers a short session of its maker's with no refresh token. 401 with the reason
 * for a token that does not work, 503 when Auth is down or another exchange holds the token too long,
 * 500 when the token store fails. */
export function kitExchange(kit: KitExchangeDeps): KitExchange {
  return async (given, client, deps) => {
    if (!KIT_TOKEN.test(given.omni_token)) return refusal({ state: 'unknown' });
    const held = await claim(kit, hashCode(given.omni_token));
    if (held instanceof Response) return held;

    const session = await renew(kit, held, client);
    if (session instanceof Response) {
      await kit.store.release(held.id, held.lease).catch((error: unknown) => {
        console.error(`ask token: kit token release: ${messageOf(error)}`);
      });
      return session;
    }
    const refused = await writeBack(kit, held, session);
    if (refused) {
      await deps.revoke?.(session.access_token).catch(() => {});
      await kit.store.release(held.id, held.lease).catch(() => {});
      return refused;
    }

    const { workspace, reason } = await placement(deps, session.user.id, given.repo);
    return reply(200, {
      access_token: session.access_token,
      refresh_token: null,
      expires_at: expiryOf(session, held, (deps.now ?? Date.now)()),
      login: loginOf(session.user),
      workspace,
      ...(reason ? { reason } : {}),
      ...(isText(session.user.email) ? { email: session.user.email } : {}),
    });
  };
}
