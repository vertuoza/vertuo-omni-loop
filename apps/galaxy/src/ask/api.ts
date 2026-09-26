// The session and round half of the ask contract (PRD 71's spec, "The contract"), as plain
// functions of a Request, so they are tested with a stubbed Supabase client and the routes under
// app/api/ask/ stay one line each:
//
//   POST /api/ask/sessions                {title}              → {id, url}
//   POST /api/ask/sessions/:id/close                           → {id, status: "closed"}
//   POST /api/ask/sessions/:id/rounds     {questions}          → {roundId}
//   GET  /api/ask/rounds/:id/wait                              → {status: open|answered|abandoned|closed, answers?}
//   POST /api/ask/rounds/:id/answers      {answers, via: "terminal"} → {id, status: "answered", via: "terminal"}
//   POST /api/ask/rounds/:id/abandon                           → {id, status: "abandoned"}
//
// Every call is refused 401 without a valid bearer token and 403 outside the crew; a session or
// round of another owner is 404, like one that does not exist. A closed session (or one 12 hours
// idle) takes no new round: 409 with `status: "closed"`. A round that is already answered is left
// as it is: 409 with `status: "answered"`. 503: no database here, or the sign-in service is down;
// 500: the database failed. Errors are `{error}` in plain words. Any of them leaves the question
// to the terminal.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, type AskCaller, type TokenCheck } from './auth';
import { askStore, AskStoreError, sessionClosed, type AskAnswers, type AskRound, type AskSession, type AskStore } from './store';

/** How long one wait holds before it answers `open`: within the 60 s the routes may run. */
export const WAIT_MS = 50_000;
/** How often a wait looks at the round again. */
export const POLL_MS = 1_000;
/** The largest body a call accepts (a round's questions, previews included). */
export const MAX_BODY_BYTES = 256 * 1024;

/** A Supabase client acting as one access token: the Auth server's check, and the tables. */
export type AskClient = TokenCheck & Pick<SupabaseClient, 'from'>;

export type AskDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => AskClient) | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  waitMs?: number;
  pollMs?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) => reply(status, { error, ...extra });
const notFound = (what: 'session' | 'round') => refuse(404, `No such ask ${what}.`);
const closedSession = () => refuse(409, 'This ask session is closed. Switch ask mode on again for a new one.', { status: 'closed' });
const alreadyAnswered = () => refuse(409, 'This round is already answered.', { status: 'answered' });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Signed = { caller: AskCaller; store: AskStore; now: () => number };

/** The caller and a store acting as them, or the Response that refuses them. */
async function signIn(request: Request, deps: AskDeps): Promise<Signed | Response> {
  if (!deps.connect) return refuse(503, 'Ask mode is not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  return { caller: auth.caller, store: askStore(deps.connect(auth.caller.token)), now: deps.now ?? Date.now };
}

/** Runs a handler, turning a database failure into a 500 rather than a guess. */
async function handle(request: Request, deps: AskDeps, run: (who: Signed) => Promise<Response>): Promise<Response> {
  try {
    const who = await signIn(request, deps);
    return who instanceof Response ? who : await run(who);
  } catch (error) {
    if (!(error instanceof AskStoreError)) throw error;
    console.error(`ask: ${error.message}`);
    return refuse(500, 'The ask database could not answer. Try again.');
  }
}

/** The JSON object a call sent, or the Response that refuses it (400, or 413 when too large). */
async function body(request: Request): Promise<Record<string, unknown> | Response> {
  const tooLarge = () => refuse(413, `A call to the ask API carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return tooLarge();
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : refuse(400, 'The body must be a JSON object.');
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
}

/** The caller's own session, or null for one that is missing, not theirs, or not an id. */
async function ownSession(who: Signed, id: string): Promise<AskSession | null> {
  if (!UUID.test(id)) return null;
  const session = await who.store.session(id);
  return session && session.owner === who.caller.id ? session : null;
}

/** The caller's own round and its session, or null. */
async function ownRound(who: Signed, id: string): Promise<{ round: AskRound; session: AskSession } | null> {
  if (!UUID.test(id)) return null;
  const round = await who.store.round(id);
  const session = round && (await ownSession(who, round.session_id));
  return round && session ? { round, session } : null;
}

/** A call keeps its session alive, unless it already reads as closed. */
async function touch(who: Signed, session: AskSession) {
  if (!sessionClosed(session, who.now())) await who.store.touchSession(session.id, new Date(who.now()));
}

/** Where the caller reached this app, behind Vercel's proxy too: the page link must use it. */
function origin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

export function openSession(request: Request, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const sent = await body(request);
    if (sent instanceof Response) return sent;
    const title = typeof sent.title === 'string' ? sent.title.trim() : '';
    if (title.length < 1 || title.length > 200) return refuse(400, 'A session needs a title of 1 to 200 characters.');
    const { id } = await who.store.openSession(title);
    return reply(200, { id, url: `${origin(request)}/ask/${id}` });
  });
}

export function closeSession(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const session = await ownSession(who, id);
    if (!session) return notFound('session');
    if (session.status !== 'closed') await who.store.closeSession(session.id, new Date(who.now()));
    return reply(200, { id: session.id, status: 'closed' });
  });
}

/** AskUserQuestion's `questions`: a non-empty list of objects, each with its question text. */
function questionsProblem(questions: unknown): string | null {
  if (!Array.isArray(questions) || questions.length === 0) return 'A round needs `questions`: AskUserQuestion\'s list, as given.';
  const fine = questions.every((q) => isRecord(q) && typeof q.question === 'string' && q.question.trim() !== '');
  return fine ? null : 'Each question needs its `question` text.';
}

export function addRound(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const sent = await body(request);
    if (sent instanceof Response) return sent;
    const problem = questionsProblem(sent.questions);
    if (problem) return refuse(400, problem);
    const session = await ownSession(who, id);
    if (!session) return notFound('session');
    if (sessionClosed(session, who.now())) return closedSession();
    try {
      const round = await who.store.addRound(session.id, sent.questions as unknown[]);
      await touch(who, session);
      return reply(200, { roundId: round.id });
    } catch (error) {
      // Closed between the read and the write: the database's policy refused the round.
      if (error instanceof AskStoreError && error.code === '42501') return closedSession();
      throw error;
    }
  });
}

type Verdict = { status: 'answered'; answers: AskAnswers } | { status: 'abandoned' } | { status: 'closed' };

function verdict(round: AskRound, session: AskSession, now: number): Verdict | null {
  if (round.status === 'answered') return { status: 'answered', answers: round.answers ?? {} };
  if (round.status === 'abandoned') return { status: 'abandoned' };
  if (sessionClosed(session, now)) return { status: 'closed' };
  return null;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function waitRound(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const found = await ownRound(who, id);
    if (!found) return notFound('round');
    let { round, session } = found;
    const first = verdict(round, session, who.now());
    if (first) return reply(200, first);
    await touch(who, session);

    const sleep = deps.sleep ?? pause;
    const pollMs = deps.pollMs ?? POLL_MS;
    const deadline = who.now() + (deps.waitMs ?? WAIT_MS);
    for (;;) {
      const left = deadline - who.now();
      if (left <= 0 || request.signal.aborted) return reply(200, { status: 'open' });
      await sleep(Math.min(pollMs, left));
      const [nextRound, nextSession] = await Promise.all([who.store.round(round.id), who.store.session(session.id)]);
      // Gone while waiting (expired, or its owner's account removed): nobody will answer it.
      if (!nextRound || !nextSession) return reply(200, { status: 'closed' });
      round = nextRound;
      session = nextSession;
      const now = verdict(round, session, who.now());
      if (now) return reply(200, now);
    }
  });
}

/** AskUserQuestion's `answers`: at least one question text → answer text. */
function isAnswers(value: unknown): value is AskAnswers {
  return isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every((a) => typeof a === 'string');
}

export function answerRound(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const sent = await body(request);
    if (sent instanceof Response) return sent;
    // The page answers through the database; this call records only what the terminal took.
    if (sent.via !== 'terminal') return refuse(400, 'This call records an answer given in the terminal: `via` must be "terminal".');
    if (!isAnswers(sent.answers)) return refuse(400, '`answers` must map each question\'s text to the answer text.');
    const found = await ownRound(who, id);
    if (!found) return notFound('round');
    if (found.round.status === 'answered') return alreadyAnswered();
    const moved = await who.store.moveRound(found.round.id, ['open', 'abandoned'], {
      status: 'answered',
      answers: sent.answers,
      answered_via: 'terminal',
    });
    if (!moved) return alreadyAnswered();
    await touch(who, found.session);
    return reply(200, { id: moved.id, status: 'answered', via: 'terminal' });
  });
}

export function abandonRound(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const found = await ownRound(who, id);
    if (!found) return notFound('round');
    const abandoned = () => reply(200, { id: found.round.id, status: 'abandoned' });
    if (found.round.status === 'abandoned') return abandoned();
    if (found.round.status === 'answered') return alreadyAnswered();
    const moved = await who.store.moveRound(found.round.id, ['open'], { status: 'abandoned' });
    if (!moved) {
      const now = await who.store.round(found.round.id);
      if (now?.status !== 'abandoned') return alreadyAnswered();
    }
    await touch(who, found.session);
    return abandoned();
  });
}
