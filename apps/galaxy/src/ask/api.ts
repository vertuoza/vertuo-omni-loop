// The session and round half of the ask contract (PRD 71's spec, "The contract"), as plain
// functions of a Request, so they are tested with a stubbed Supabase client and the routes under
// app/api/ask/ stay one line each:
//
//   POST /api/ask/sessions                {title, context?}    → {id, url}
//   POST /api/ask/sessions/:id/close                           → {id, status: "closed"}
//   DELETE /api/ask/sessions/:id                               → {id, deleted: true}
//   POST /api/ask/sessions/:id/rounds     {questions, context?} → {roundId}
//   GET  /api/ask/rounds/:id/wait                              → {status: open|answered|abandoned|closed, answers?, attachments?}
//   POST /api/ask/rounds/:id/answers      {answers, via: "terminal"} → {id, status: "answered", via: "terminal"}
//   POST /api/ask/rounds/:id/abandon                           → {id, status: "abandoned"}
//   PATCH /api/ask/rounds/:id/category    {category}           → {id, category, category_by}
//   POST /api/ask/rounds/:id/shares       {member}             → {roundId, sharedWith, url}
//   GET  /api/ask/workspace?repo=owner/name                    → {workspace: {slug, name} | null, reason: string | null}
//
// Every call is refused 401 without a valid bearer token. Any signed-in account is let through: what it
// may do is the database's call, by workspace membership (PRD 459). Opening a session with no workspace
// to go to — a repository another workspace owns, or none owns and the caller is in no workspace — is
// 403 with the database's reason (and the App's install link after its install hint), never 500. A session or
// round of another owner is 404, like one that does not exist — except a delete by a member of the
// session's workspace who is not its owner, who reads it (PRD 144) and is refused 403. A closed session (or one 12 hours
// idle) takes no new round: 409 with `status: "closed"`. A round that is already answered is left
// as it is: 409 with `status: "answered"`, naming who answered it and which way (`answeredBy: {id,
// name}`, `via`): the first answer wins. 503: no database here, or the sign-in service is down;
// 500: the database failed. Errors are `{error}` in plain words. Any of them leaves the question
// to the terminal.
//
// `context` is optional on both (PRD 144): `{repo}` on a session, and on a round where it came from
// and what the Claude session had cost by then — `{repo, branch, prd, claudeSessionId, skill, model,
// tokens}`, each field null or missing when the kit could not read it. A field this API does not know
// is ignored; a known one of the wrong shape is refused with 400. The round's cost comes from the one
// price table (./prices.ts). Who answered is never taken from a body: the database sets it.
//
// A round's category (PRD 144) is one of six (./classify.ts). Once a round is created, the model sorts
// it after the response has gone (`later`, Next's after()), so asking never waits on it; any failure
// leaves it unsorted, and nothing retries. Any member of the session's workspace sets, changes or
// clears it (`category: null`); a round of another workspace is 404. The model never overrides a
// person: the database records its guess only while nobody has set one.
//
// The session's owner shares a round (PRD 144) with another member of the session's workspace, who may
// then answer it on the page while it is open (/ask/q/<round>). Sharing any other round is refused:
// 403 for a member who is not the owner, 400 for someone outside the workspace (or the owner themself).
//
// An answer given on the page may carry screenshots (PRD 620). `wait` then also hands back, per question,
// each one's file name and a signed link valid 10 minutes, made as the caller (`{name, url}`, `url`
// null for a link that could not be made); an answer without any carries no `attachments` field.
//
// Where a repository's questions land (PRD 459) is asked by `omni ask on` and `omni ask status`: the
// workspace, or the database's reason why none (repo_workspace(), through the same service-role lookup
// the terminal sign-in uses), both as 200: it is a question of fact, not a refusal of the call. When
// this deployment cannot look it up (no service role), both are null and the terminal says nothing more.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Placement } from './cli-code';
import { authenticate, withInstallLink, type AskCaller, type TokenCheck } from './auth';
import { CATEGORIES, isCategory, type Category, type Classifier, type ClassifyInput } from './classify';
import { costUsd } from './prices';
import {
  askAttachments, askCategories, askShares, askStore, AskStoreError, memberLabel, sessionClosed,
  type AskAnswers, type AskAttachmentFiles, type AskCategories, type AskRound, type AskRoundFacts, type AskSession, type AskShares, type AskStore, type AskTokens,
} from './store';

/** How long one wait holds before it answers `open`: within the 60 s the routes may run. */
export const WAIT_MS = 50_000;
/** How often a wait looks at the round again. */
export const POLL_MS = 1_000;
/** The largest body a call accepts (a round's questions, previews included). */
export const MAX_BODY_BYTES = 256 * 1024;

/** A Supabase client acting as one access token: the Auth server's check, and the tables. */
export type AskClient = TokenCheck & Pick<SupabaseClient, 'from' | 'rpc' | 'storage'>;

export type AskDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => AskClient) | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  waitMs?: number;
  pollMs?: number;
  /** Sorts a new round into one of six, or null when there is no classifier (no key): it stays unsorted. */
  classify?: Classifier | null;
  /** Runs a task once the response has gone (Next's after()); without it, the task just starts. */
  later?: (task: () => Promise<void>) => void;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
  /** Where a person's calls for a repository go (repo_workspace()); absent: nobody can say here. */
  place?: (userId: string, repo: string) => Promise<Placement>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) => reply(status, { error, ...extra });
const notFound = (what: 'session' | 'round') => refuse(404, `No such ask ${what}.`);
const closedSession = () => refuse(409, 'This ask session is closed. Switch ask mode on again for a new one.', { status: 'closed' });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Signed = {
  caller: AskCaller; store: AskStore; categories: AskCategories; shares: AskShares; files: AskAttachmentFiles; now: () => number;
};

/** The caller and a store acting as them, or the Response that refuses them. */
async function signIn(request: Request, deps: AskDeps): Promise<Signed | Response> {
  if (!deps.connect) return refuse(503, 'Ask mode is not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const client = deps.connect(auth.caller.token);
  return {
    caller: auth.caller,
    store: askStore(client),
    categories: askCategories(client),
    shares: askShares(client),
    files: askAttachments(client),
    now: deps.now ?? Date.now,
  };
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

/** 409 for a round already answered, naming who answered it and which way: the first answer wins. */
async function alreadyAnswered(who: Signed, roundId: string, session: AskSession): Promise<Response> {
  const round = await who.store.round(roundId);
  const by = round?.answered_by ?? null;
  const member = by && session.workspace_id ? (await who.shares.members(session.workspace_id)).find((m) => m.user_id === by) : undefined;
  const name = member ? memberLabel(member) : null;
  const via = round?.answered_via ?? null;
  const way = via === 'terminal' ? ', in the terminal' : via === 'page' ? ', on the page' : '';
  return refuse(409, `This round is already answered${name ? ` by ${name}` : ''}${way}.`, {
    status: 'answered',
    answeredBy: by ? { id: by, name } : null,
    via,
  });
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

/** A context field: missing or null reads as null; `ok` says whether a value it holds is fine. */
type Field<T> = { value: T | null } | { problem: string };

function field<T>(context: Record<string, unknown>, key: string, ok: (value: unknown) => value is T, shape: string): Field<T> {
  const value = context[key];
  if (value === undefined || value === null) return { value: null };
  return ok(value) ? { value } : { problem: `\`context.${key}\` must be ${shape}, or null.` };
}

const text = (max: number) => (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= max;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const isRepo = (value: unknown): value is string => text(200)(value) && REPO.test(value);
const isPrd = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const TOKEN_KEYS = ['cacheRead', 'cacheWrite', 'input', 'output'];
const isTokens = (value: unknown): value is AskTokens =>
  isRecord(value) && Object.keys(value).sort().join() === TOKEN_KEYS.join() && Object.values(value).every(count);

type RoundContext = { repo: string | null; branch: string | null; prd: number | null; claudeSessionId: string | null;
  skill: string | null; model: string | null; tokens: AskTokens | null };

/** The context a body carries — every field null when it carries none — or why it is refused. */
function readContext(sent: Record<string, unknown>, keys: Array<keyof RoundContext>): { context: RoundContext } | { problem: string } {
  const empty: RoundContext = { repo: null, branch: null, prd: null, claudeSessionId: null, skill: null, model: null, tokens: null };
  if (sent.context === undefined || sent.context === null) return { context: empty };
  if (!isRecord(sent.context)) return { problem: '`context`, when sent, must be a JSON object.' };
  const fields: Record<keyof RoundContext, Field<unknown>> = {
    repo: field(sent.context, 'repo', isRepo, 'owner/name'),
    branch: field(sent.context, 'branch', text(250), 'a branch name of 1 to 250 characters'),
    prd: field(sent.context, 'prd', isPrd, 'a PRD number'),
    claudeSessionId: field(sent.context, 'claudeSessionId', text(200), 'a text of 1 to 200 characters'),
    skill: field(sent.context, 'skill', text(200), 'a text of 1 to 200 characters'),
    model: field(sent.context, 'model', text(200), 'a model id of 1 to 200 characters'),
    tokens: field(sent.context, 'tokens', isTokens, 'whole numbers {input, output, cacheRead, cacheWrite}'),
  };
  const context = { ...empty };
  for (const key of keys) {
    const got = fields[key];
    if ('problem' in got) return { problem: got.problem };
    (context as Record<string, unknown>)[key] = got.value;
  }
  return { context };
}

const ROUND_KEYS: Array<keyof RoundContext> = ['repo', 'branch', 'prd', 'claudeSessionId', 'skill', 'model', 'tokens'];

export function openSession(request: Request, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const sent = await body(request);
    if (sent instanceof Response) return sent;
    const title = typeof sent.title === 'string' ? sent.title.trim() : '';
    if (title.length < 1 || title.length > 200) return refuse(400, 'A session needs a title of 1 to 200 characters.');
    const read = readContext(sent, ['repo']);
    if ('problem' in read) return refuse(400, read.problem);
    try {
      const { id } = await who.store.openSession(title, read.context.repo);
      return reply(200, { id, url: `${origin(request)}/ask/${id}` });
    } catch (error) {
      // Nowhere to go (repo_workspace()): the database's reason, not a failure.
      if (error instanceof AskStoreError && error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
      throw error;
    }
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

/** Deletes the caller's own session and its rounds, for good (PRD 144: kept until its owner deletes it). */
export function deleteSession(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const session = UUID.test(id) ? await who.store.session(id) : null;
    if (!session) return notFound('session');
    if (session.owner !== who.caller.id) return refuse(403, 'Only the session\'s owner deletes it.');
    if (!(await who.store.deleteSession(session.id))) return notFound('session');
    return reply(200, { id: session.id, deleted: true });
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
    const read = readContext(sent, ROUND_KEYS);
    if ('problem' in read) return refuse(400, read.problem);
    const { context } = read;
    const session = await ownSession(who, id);
    if (!session) return notFound('session');
    if (sessionClosed(session, who.now())) return closedSession();
    const facts: AskRoundFacts = {
      prd: context.prd,
      skill: context.skill,
      model: context.model,
      tokens: context.tokens,
      cost_usd: costUsd(context.model, context.tokens),
    };
    try {
      const round = await who.store.addRound(session.id, sent.questions as unknown[], facts);
      await touch(who, session);
      await who.store.placeSession(session.id, {
        ...(context.branch !== null && { branch: context.branch }),
        ...(context.claudeSessionId !== null && { claude_session_id: context.claudeSessionId }),
      });
      sortLater(who, deps, round.id, {
        questions: sent.questions as unknown[],
        context: { repo: context.repo ?? session.repo, branch: context.branch, prd: context.prd, skill: context.skill },
      });
      return reply(200, { roundId: round.id });
    } catch (error) {
      // Closed between the read and the write: the database's policy refused the round.
      if (error instanceof AskStoreError && error.code === '42501') return closedSession();
      throw error;
    }
  });
}

/** Has the model sort the round once the response has gone. Nothing it does can fail the round: a
 * null reply, an error or a timeout leaves it unsorted, and nothing retries. */
function sortLater(who: Signed, deps: AskDeps, roundId: string, input: ClassifyInput) {
  const classify = deps.classify;
  if (!classify) return;
  const task = async () => {
    try {
      const category = await classify(input);
      if (category) await who.categories.classified(roundId, category);
    } catch (error) {
      console.error(`ask: round ${roundId} stays unsorted: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  (deps.later ?? ((run) => void run()))(task);
}

/** A screenshot as `wait` hands it back: its file name, and a signed link or null. */
type AttachmentLink = { name: string; url: string | null };

type Verdict =
  | { status: 'answered'; answers: AskAnswers; attachments?: Record<string, AttachmentLink[]> }
  | { status: 'abandoned' }
  | { status: 'closed' };

function verdict(round: AskRound, session: AskSession, now: number): Verdict | null {
  if (round.status === 'answered') return { status: 'answered', answers: round.answers ?? {} };
  if (round.status === 'abandoned') return { status: 'abandoned' };
  if (sessionClosed(session, now)) return { status: 'closed' };
  return null;
}

/** The verdict with its screenshots' links, when it is an answer that has any; as it was otherwise. */
async function withLinks(who: Signed, round: AskRound, found: Verdict): Promise<Verdict> {
  if (found.status !== 'answered' || !round.attachments) return found;
  const entries = Object.entries(round.attachments).filter(([, paths]) => Array.isArray(paths) && paths.length > 0);
  if (entries.length === 0) return found;
  const urls = await who.files.links(entries.flatMap(([, paths]) => paths));
  let at = 0;
  const attachments = Object.fromEntries(entries.map(([question, paths]) => [
    question,
    paths.map((path) => ({ name: path.slice(path.lastIndexOf('/') + 1), url: urls[at++] ?? null })),
  ]));
  return { ...found, attachments };
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function waitRound(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const found = await ownRound(who, id);
    if (!found) return notFound('round');
    let { round, session } = found;
    const first = verdict(round, session, who.now());
    if (first) return reply(200, await withLinks(who, round, first));
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
      if (now) return reply(200, await withLinks(who, round, now));
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
    if (found.round.status === 'answered') return alreadyAnswered(who, found.round.id, found.session);
    const moved = await who.store.moveRound(found.round.id, ['open', 'abandoned'], {
      status: 'answered',
      answers: sent.answers,
      answered_via: 'terminal',
    });
    if (!moved) return alreadyAnswered(who, found.round.id, found.session);
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
    if (found.round.status === 'answered') return alreadyAnswered(who, found.round.id, found.session);
    const moved = await who.store.moveRound(found.round.id, ['open'], { status: 'abandoned' });
    if (!moved) {
      const now = await who.store.round(found.round.id);
      if (now?.status !== 'abandoned') return alreadyAnswered(who, found.round.id, found.session);
    }
    await touch(who, found.session);
    return abandoned();
  });
}

/** Sets a round's category, changes it, or clears it with null: any member of the session's workspace. */
export function categorizeRound(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const sent = await body(request);
    if (sent instanceof Response) return sent;
    const category = sent.category;
    if (!(category === null || isCategory(category))) {
      return refuse(400, `\`category\` must be one of ${CATEGORIES.join(', ')}, or null to leave the round unsorted.`);
    }
    if (!UUID.test(id)) return notFound('round');
    const set = await who.categories.set(id, category as Category | null);
    if (!set) return notFound('round');
    return reply(200, { id, category: set.category, category_by: set.category_by });
  });
}

/** The session's owner shares a round with another member of its workspace, and gets the link to it. */
export function shareRound(request: Request, id: string, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const sent = await body(request);
    if (sent instanceof Response) return sent;
    const round = UUID.test(id) ? await who.store.round(id) : null;
    const session = round && (await who.store.session(round.session_id));
    if (!round || !session) return notFound('round');
    if (session.owner !== who.caller.id) return refuse(403, 'Only the session\'s owner shares its questions.');
    const member = sent.member;
    const outside = () => refuse(400, '`member` must be the id of another member of this session\'s workspace.');
    if (typeof member !== 'string' || !UUID.test(member)) return outside();
    if (!(await who.shares.share(round.id, member))) return outside();
    return reply(200, { roundId: round.id, sharedWith: member, url: `${origin(request)}/ask/q/${round.id}` });
  });
}

/** Where the caller's questions for `?repo=owner/name` land: the workspace, or the database's reason. */
export function whereQuestionsGo(request: Request, deps: AskDeps): Promise<Response> {
  return handle(request, deps, async (who) => {
    const repo = new URL(request.url).searchParams.get('repo');
    if (!isRepo(repo)) return refuse(400, '`repo` must be the repository as owner/name.');
    if (!deps.place) return reply(200, { workspace: null, reason: null });
    let placed: Placement;
    try {
      placed = await deps.place(who.caller.id, repo);
    } catch (error) {
      console.error(`ask: where ${repo} goes: ${error instanceof Error ? error.message : String(error)}`);
      return refuse(500, 'The ask database could not say where this repository\'s questions go. Try again.');
    }
    if (placed.workspace) return reply(200, { workspace: { slug: placed.workspace.slug, name: placed.workspace.name }, reason: null });
    return reply(200, { workspace: null, reason: placed.reason ? withInstallLink(placed.reason, deps.installLink) : null });
  });
}
