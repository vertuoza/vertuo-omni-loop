// Mark as done (PRD 1218, s7): a `person` prerequisite of a roadmap ticked from its Prerequisites tab, as
// the signed-in member, through the omni-loop App's user authorisation as the outbox send does
// (../../outbox/send.ts, ADR-0052). Two plain functions of a Request, tested with a fake store and a fake
// GitHub:
//
//   POST /api/roadmaps/tick  {roadmap, row}   → 200 {authorize}  + the tick's cookie
//   GET  /prd/github/callback?code&state     → 303 back to the roadmap's Prerequisites tab
//
// 1. startTick, as the signed-in person: the roadmap must be one they read (row-level security: another
//    workspace's reads as none) and the row a `person` one of it. The answer is the address of GitHub's
//    authorisation of the omni-loop App; its state, `tick~<roadmap>~<row>~<nonce>`, names what is ticked,
//    and a short-lived, http-only cookie carries the same three, only as far as the callback. Nothing is
//    stored: the tick is the comment, and the roadmap and row are all it needs.
// 2. finishTick: the state must match the cookie, the roadmap must still be read by the caller and the row
//    still a `person` one; otherwise nothing is posted. The code is traded for a user token, the kit's tick
//    comment (`omni roadmap tick`'s, which `omni roadmap prereqs` reads back) is posted on the roadmap's
//    issue with it, the token is dropped — never stored, logged or sent to the browser — and the person
//    lands on the tab with the row ticked, or with why nothing was posted. GitHub takes a code once, so a
//    replayed callback cannot post a second time.
//
// The callback is the outbox send's, `/prd/github/callback`, the one the App lists: isTickState tells a
// tick's state from a send's.
import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { parsePr, type IssueNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { group } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { tickComment } from 'vertuo-omni-plan/kit/lib/roadmap/prereqs/ticks.ts';
import { requestOrigin } from '../../ask/page/sign-in';
import { GitHubError, sendCallbackPath, type GitHubUser } from '../../outbox/send';
import { RowIdSchema, type RoadmapPrerequisiteRow } from '../store';

/** Where GitHub sends the person back: the outbox send's callback, the one the App lists. */
export const tickCallbackPath = sendCallbackPath;

/** The cookie that carries a tick's roadmap, row and nonce to the callback, and no further. */
export const TICK_COOKIE = 'omni-tick';
const COOKIE_MAX_AGE = 600;

const AUTHORIZE = 'https://github.com/login/oauth/authorize';

// ── The ports ──────────────────────────────────────────────────────────────────

/** A roadmap as the signed-in person reads it: where its issue is, and who does each prerequisite. */
export type TickTarget = { roadmapId: string; repo: string; number: IssueNumber; rows: Record<string, RoadmapPrerequisiteRow['who']> };

export type TickStore = {
  /** The roadmap, or null when the caller is no member of its workspace (or it does not exist). */
  target(roadmapId: string): Promise<TickTarget | null>;
};

/** What a tick asks of GitHub, as the person: the outbox send's (../../outbox/send.ts). */
export type TickGitHub = {
  exchange(code: string): Promise<string>;
  comment(token: string, repo: string, number: IssueNumber, body: string): Promise<{ url: string }>;
};

/** The outbox send's GitHub, as a tick asks it: GitHub's issue comments take an issue's number as a pull
 * request's, on the same endpoint. */
export function tickGitHub(user: GitHubUser): TickGitHub {
  return {
    exchange: (code) => user.exchange(code),
    comment: (token, repo, number, body) => user.comment(token, repo, parsePr(number), body),
  };
}

export type TickDeps = {
  /** The omni-loop App's client id (GITHUB_APP_CLIENT_ID), or null: marking is off here. */
  clientId: string | null;
  /** The store as the signed-in person, or null when nobody is signed in (or no database). */
  store: () => Promise<TickStore | null>;
  github: () => TickGitHub;
  nonce?: () => string;
};

/** Why a tick was not posted, as the tab names it (`?tick_error=`). */
type TickError = 'signin' | 'state' | 'gone' | 'not-person' | 'refused' | 'down' | 'no-access';

// ── POST /api/roadmaps/tick ────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TickBody = z.strictObject({
  roadmap: z.string().regex(UUID, 'a roadmap id'),
  row: RowIdSchema,
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const refuse = (status: number, error: string) => json(status, { error });

function tickCookie(value: string, maxAge: number) {
  return `${TICK_COOKIE}=${value}; Path=${tickCallbackPath}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

/** Whether the roadmap holds `row` as a `person` row: a refusal's status and words, or null. */
function personRow(target: TickTarget, row: string): { status: number; error: string } | null {
  const who = target.rows[row];
  if (who === undefined) return { status: 404, error: `This roadmap has no prerequisite ${row}.` };
  if (who !== 'person') return { status: 409, error: `${row} is checked by the agent: only a person row is marked as done.` };
  return null;
}

export async function startTick(request: Request, deps: TickDeps): Promise<Response> {
  if (!deps.clientId) return refuse(503, 'Marking as done is not open here: run omni roadmap tick from a checkout.');
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');

  // A body that is no JSON parses as null, and is refused as malformed.
  const parsed = TickBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refuse(400, 'A tick names a roadmap by its id and one of its prerequisites by its id, and nothing else.');
  const { roadmap, row } = parsed.data;

  const target = await store.target(roadmap.toLowerCase());
  if (!target) return refuse(404, 'No such roadmap.');
  const wrong = personRow(target, row);
  if (wrong) return refuse(wrong.status, wrong.error);

  const nonce = (deps.nonce ?? (() => randomBytes(32).toString('base64url')))();
  const carried = `${target.roadmapId}~${row}~${nonce}`;
  const authorize = new URL(AUTHORIZE);
  authorize.searchParams.set('client_id', deps.clientId);
  authorize.searchParams.set('redirect_uri', `${requestOrigin(request)}${tickCallbackPath}`);
  authorize.searchParams.set('state', `tick~${carried}`);
  return json(200, { authorize: authorize.toString() }, { 'set-cookie': tickCookie(carried, COOKIE_MAX_AGE) });
}

// ── /prd/github/callback, for a tick ───────────────────────────────────────────

const STATE = /^tick~([0-9a-f-]{36})~([A-Za-z0-9][A-Za-z0-9._-]{0,19})~([A-Za-z0-9_-]{16,128})$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;

/** Whether the callback's state is a tick's, not an outbox send's. */
export const isTickState = (request: Request): boolean => (new URL(request.url).searchParams.get('state') ?? '').startsWith('tick~');

const CARRIED = new RegExp(`(?:^|;)\\s*${TICK_COOKIE}=([^;]+)`);

/** Whether the tick's cookie carries exactly what the state names. */
function carriedBy(request: Request, given: string): boolean {
  const cookie = CARRIED.exec(request.headers.get('cookie') ?? '')?.[1]?.trim();
  if (!cookie) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(cookie);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ERROR_OF: Record<GitHubError['kind'], TickError> = { refused: 'refused', down: 'down', 'no-access': 'no-access', gone: 'gone' };

export async function finishTick(request: Request, deps: Pick<TickDeps, 'store' | 'github'>): Promise<Response> {
  const origin = requestOrigin(request);
  const back = (location: string) => new Response(null, {
    status: 303,
    headers: { location: `${origin}${location}`, 'cache-control': 'no-store', 'set-cookie': tickCookie('', 0) },
  });
  const tab = (roadmap: string, query: string) => back(`/roadmaps/${roadmap}?tab=prerequisites&${query}`);

  const url = new URL(request.url);
  const state = STATE.exec(url.searchParams.get('state') ?? '');
  const store = await deps.store();
  if (!store) return back('/roadmaps?tick_error=signin');
  if (!state) return back('/roadmaps?tick_error=state');
  const roadmap = group(state, 1).toLowerCase();
  const row = group(state, 2);
  const carried = `${group(state, 1)}~${row}~${group(state, 3)}`;
  if (!carriedBy(request, carried)) return tab(roadmap, 'tick_error=state');

  const target = await store.target(roadmap);
  if (!target || !REPO.test(target.repo)) return tab(roadmap, 'tick_error=gone');
  if (personRow(target, row)) return tab(roadmap, 'tick_error=not-person');

  try {
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error') || !code) throw new GitHubError('refused', null);
    const github = deps.github();
    let token: string | null = await github.exchange(code);
    try {
      await github.comment(token, target.repo, target.number, tickComment(row));
    } finally {
      token = null;
    }
  } catch (error) {
    if (!(error instanceof GitHubError)) throw error;
    console.error(`roadmap tick ${roadmap} ${row}: ${error.message}`);
    return tab(roadmap, `tick_error=${ERROR_OF[error.kind]}`);
  }
  return tab(roadmap, `ticked=${encodeURIComponent(row)}`);
}
