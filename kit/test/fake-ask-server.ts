// A fake ask-mode server: the HTTP contract under `/api/ask/*` (PRD 71's spec, "The contract"),
// held in memory, for the kit's tests and for a live tracer run. It checks the bearer token on every
// call but the token exchange, and it records every call it gets.
//
// It honours the dossier calls too (PRD 216's spec, "The contract"): `POST /api/dossiers` opens a
// draft, `POST /api/dossiers/push` finds the dossier (the draft named, else the one keyed by repo and
// PRD, else a new one), numbers a draft — merging it into a dossier already keyed the same — and adds
// a version of each kind only when the hash of its content differs from the latest. It refuses as the
// real server does: 400 for a malformed body, 404 for a draft it does not have, 413 past the body or
// artifact cap.
//
// With `place`, it answers `GET /api/ask/workspace?repo=owner/name` (PRD 459) with what `place(repo)`
// returns, `{ workspace, reason }`; without it, that call is a 404, as from a server older than it.
// With `business`, it answers `GET /api/business?repo=owner/name` (PRD 748) with what
// `business(repo)` returns, `{ status, body }` (status 200 when not given; the body, personas included
// since PRD 799, as given); without it, a 404. With
// `cite`, it answers `POST /api/business/citations` with what `cite(body)` returns, the same way. With
// `claim`, it answers `POST /api/business/claims` (PRD 822) with what `claim(body)` returns, the same way.
//
// It honours `POST /api/ask/heartbeat` (PRD 757): a body of exactly `claudeSessionId`, `repo`, `work`
// and an optional `ended: true`, else 400; each accepted one is kept in `heartbeats`. With
// `heartbeat`, it answers what `heartbeat(body)` returns, `{ status, delayMs }`; without it, 204.
//
// Every body it receives is read as `unknown` (PRD 976), field by field, as the real server's handlers
// parse theirs; what it holds (sessions, rounds, dossiers) has its own type.
//
// In a test:   const server = await startFakeAskServer({ answer: (round) => ({ ... }) });
// By hand:     node kit/test/fake-ask-server.ts [--port <p>] [--answer first|none] [--token <t>]
//              prints one JSON line `{ url, host, sessionId, accessToken, refreshToken }`, then one
//              JSON line per call it serves.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { realpathSync } from 'node:fs';
import { text as readText } from 'node:stream/consumers';
import { fileURLToPath } from 'node:url';
import { isOneOf, messageOf, propertyOf } from '../lib/narrow.ts';
import { assertDefined } from './assert.ts';

/** A request body, a round's questions, a session's context: JSON the fake reads field by field. */
export type Json = unknown;

/** A handler's answer: its status (200 when not given) and its body. */
type Reply = { status?: number; body: unknown };

/** What the fake records of each call. */
type Call = { method: string | undefined; path: string; body: Json; authorization: string | null };

/** A session as the fake holds it. */
type Session = { id: string; title: string; status: 'open' | 'closed'; context: unknown };

/** A round as the fake holds it: its questions as posted, and its answers once given. */
type Round = {
  id: string;
  sessionId: string;
  questions: unknown[];
  context: unknown;
  lead: unknown;
  status: 'open' | 'answered' | 'abandoned';
  answers: unknown;
  answeredVia: unknown;
};

/** One version of one kind of a dossier's artifacts. */
type Version = { kind: string; content: string; sha256: string };

/** A dossier as the fake holds it: a draft has no PRD yet. */
type Dossier = { id: string; repo: string; prd: number | null; title: string; claudeSessionId: unknown; versions: Version[] };

const json = (response: ServerResponse, status: number, body?: unknown): ServerResponse => {
  response.writeHead(status, { 'content-type': 'application/json' });
  return response.end(body === undefined ? '' : JSON.stringify(body));
};

function parseBody(text: string): Json {
  if (!text) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return null;
  }
}

/** A list read from JSON: nothing reads as no item, and anything else but a list is refused. */
function listOf(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError(`expected a list, got ${typeof value}`);
  return value;
}

/**
 * The answer every question's first option gives: a multi-select takes its first two labels, joined
 * the way `AskUserQuestion` joins them.
 */
export function firstOptionAnswers(questions: Json): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const question of listOf(questions)) {
    const labels = listOf(propertyOf(question, 'options')).map((option) => propertyOf(option, 'label'));
    const answer = propertyOf(question, 'multiSelect') ? labels.slice(0, 2).join(', ') : labels[0];
    if (typeof answer === 'string') answers[String(propertyOf(question, 'question'))] = answer;
  }
  return answers;
}

const HEARTBEAT_FIELDS = ['claudeSessionId', 'repo', 'work', 'ended'];
const REPO = /^[\w.-]+\/[\w.-]+$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A heartbeat's body as the contract has it: its session, its repository, what it works on. */
function isHeartbeat(body: Json): boolean {
  if (!isObject(body) || Object.keys(body).some((key) => !HEARTBEAT_FIELDS.includes(key))) return false;
  const { claudeSessionId, repo, ended, work } = body;
  if (typeof claudeSessionId !== 'string' || !claudeSessionId) return false;
  if (typeof repo !== 'string' || !REPO.test(repo)) return false;
  return (ended === undefined || ended === true) && isWork(work);
}

/** A heartbeat's work: null, a draft by its id, or a PRD or fix by its number. */
function isWork(work: Json): boolean {
  if (work === null) return true;
  if (!isObject(work) || Object.keys(work).length !== 2) return false;
  const { kind, draftId, number } = work;
  if (kind === 'draft') return typeof draftId === 'string' && draftId !== '';
  return isOneOf(['prd', 'visual', 'bug'], kind) && typeof number === 'number' && Number.isInteger(number) && number > 0;
}

const DOSSIER_KINDS = ['spec', 'plan', 'before-after'];
const sha256 = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex');

/** One artifact of a push, or null when its kind is none of the dossier's or its content is not text. */
function artifactOf(value: unknown): { kind: string; content: string } | null {
  const kind = propertyOf(value, 'kind');
  const content = propertyOf(value, 'content');
  return isOneOf(DOSSIER_KINDS, kind) && typeof content === 'string' ? { kind, content } : null;
}

/** A field of a body that is text, or undefined. */
function textField(body: Json, key: string): string | undefined {
  const value = propertyOf(body, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * The options, each with its default below:
 *
 *   port?: number,
 *   holdMs?: number,             how long `wait` holds an open round (the real server: 50 s)
 *   dossierBodyBytes?: number, artifactBytes?: number,
 *                                the push's caps (the real server: 2 MiB and 512 KiB), past which it answers 413
 *   accessToken?: string, refreshToken?: string, codes?: string[], email?: string,
 *   answer?: (round: { id: string, questions: object[] }) => (Record<string, string> | null),
 *                                answers a round the moment it is posted, or leaves it open (null)
 *   onCall?: (call: object) => void,
 *   place?: (repo: string) => ({ workspace: { slug: string, name: string } | null, reason: string | null }),
 *                                where a repository's questions land; absent: the call is a 404
 *   business?: (repo: string) => ({ status?: number, body: object }),
 *                                what `GET /api/business?repo=` answers (PRD 748); absent: a 404
 *   cite?: (body: object) => ({ status?: number, body: object }),
 *                                what `POST /api/business/citations` answers (PRD 748); absent: a 404
 *   claim?: (body: object) => ({ status?: number, body: object }),
 *                                what `POST /api/business/claims` answers (PRD 822); absent: a 404
 *   tokenExtras?: object,        more fields in every token reply (the real one adds login, workspace, reason)
 *   heartbeat?: (body: object) => ({ status: number, delayMs?: number }),
 *                                how a well-formed heartbeat is answered, and after how long
 */
/** A fake ask server a test started: its address, what it recorded, and the handles that steer it. */
export type FakeAskServer = Awaited<ReturnType<typeof startFakeAskServer>>;

export async function startFakeAskServer({
  port = 0,
  holdMs = 50,
  accessToken = 'access-1',
  refreshToken = 'refresh-1',
  codes = [],
  email = 'person@example.com',
  answer = () => null,
  onCall = () => undefined,
  dossierBodyBytes = 2 * 1024 * 1024,
  artifactBytes = 512 * 1024,
  place = null,
  business = null,
  cite = null,
  claim = null,
  tokenExtras = {},
  heartbeat = () => ({ status: 204 }),
}: {
  port?: number;
  holdMs?: number;
  accessToken?: string | undefined;
  refreshToken?: string;
  codes?: string[];
  email?: string;
  answer?: (round: Round) => Record<string, string> | null;
  onCall?: (call: Call) => void;
  dossierBodyBytes?: number;
  artifactBytes?: number;
  place?: ((repo: string) => unknown) | null;
  business?: ((repo: string) => Reply) | null | undefined;
  cite?: ((body: Json) => Reply) | null | undefined;
  claim?: ((body: Json) => Reply) | null | undefined;
  tokenExtras?: Record<string, unknown>;
  heartbeat?: (body: Json) => { status?: number; delayMs?: number } | null | undefined;
} = {}) {
  const access = new Set([accessToken]);
  const refresh = new Set([refreshToken]);
  const oneTimeCodes = new Set(codes);
  const sessions = new Map<string, Session>();
  const rounds = new Map<string, Round>();
  const waiters = new Map<string, (() => void)[]>();
  const calls: Call[] = [];
  const dossiers = new Map<string, Dossier>();
  const heartbeats: Json[] = [];
  let issued = 1;
  let denied = false;
  let nextId = 1;
  let base = '';

  const settle = (roundId: string) => {
    for (const wake of waiters.get(roundId) ?? []) wake();
    waiters.delete(roundId);
  };

  function issueTokens() {
    issued += 1;
    const tokens = { access_token: `access-${issued}`, refresh_token: `refresh-${issued}`, expires_at: Date.now() + 3600_000, email, ...tokenExtras };
    access.add(tokens.access_token);
    refresh.add(tokens.refresh_token);
    return tokens;
  }

  function openSession(title = 'fake session', context: unknown = null) {
    const id = `sess-${nextId++}`;
    sessions.set(id, { id, title, status: 'open', context });
    return { id, url: `${base}/ask/${id}` };
  }

  function answerRound(roundId: string, answers: unknown, via: unknown = 'page') {
    const round = rounds.get(roundId);
    assertDefined(round, `round ${roundId}`);
    Object.assign(round, { status: 'answered', answers, answeredVia: via });
    settle(roundId);
  }

  function closeSession(id: string) {
    const session = sessions.get(id);
    assertDefined(session, `session ${id}`);
    session.status = 'closed';
    for (const round of rounds.values()) if (round.sessionId === id) settle(round.id);
  }

  function waitResult(round: Round) {
    if (sessions.get(round.sessionId)?.status === 'closed') return { status: 'closed' };
    if (round.status === 'answered') return { status: 'answered', answers: round.answers };
    return { status: round.status };
  }

  /** A dossier as the contract answers it. */
  const dossierReply = (dossier: Dossier, more: Record<string, unknown> = {}) => ({ id: dossier.id, url: `${base}/prd/${dossier.id}`, ...more });

  function openDossier(body: Json): Dossier | null {
    const title = textField(body, 'title')?.trim() ?? '';
    const repo = textField(body, 'repo');
    if (!title || title.length > 200 || repo === undefined || !REPO.test(repo)) return null;
    const id = `dossier-${nextId++}`;
    const dossier: Dossier = {
      id, repo: repo.toLowerCase(), prd: null, title, claudeSessionId: propertyOf(body, 'claudeSessionId') ?? null, versions: [],
    };
    dossiers.set(id, dossier);
    return dossier;
  }

  /** The push's fields, or null when any is malformed. */
  function readPush(body: Json): { repo: string; prd: number; title: string; draftId: unknown; artifacts: { kind: string; content: string }[] } | null {
    const repo = textField(body, 'repo');
    const prd = propertyOf(body, 'prd');
    const title = textField(body, 'title');
    const draftId = propertyOf(body, 'draftId') ?? null;
    const given = propertyOf(body, 'artifacts');
    if (repo === undefined || !REPO.test(repo) || typeof prd !== 'number' || !Number.isInteger(prd) || prd <= 0) return null;
    if (title === undefined || !title.trim() || !Array.isArray(given)) return null;
    const artifacts = given.map(artifactOf);
    if (!artifacts.every((artifact) => artifact !== null)) return null;
    return { repo, prd, title, draftId, artifacts };
  }

  /** The push: `{ status, body }`, as the real server answers it. */
  function pushDossier(body: Json, raw: string): { status: number; body: unknown } {
    if (Buffer.byteLength(raw) > dossierBodyBytes) return { status: 413, body: { error: 'too large' } };
    const push = readPush(body);
    if (!push) return { status: 400, body: { error: 'malformed push' } };
    const { repo, prd, title, draftId, artifacts } = push;
    if (artifacts.some((a) => Buffer.byteLength(a.content) > artifactBytes)) return { status: 413, body: { error: 'artifact too large' } };
    const home = repo.toLowerCase();
    const keyed = () => [...dossiers.values()].find((d) => d.repo === home && d.prd === prd);
    let dossier: Dossier | undefined;
    if (draftId !== null) {
      const draft = typeof draftId === 'string' ? dossiers.get(draftId) : undefined;
      if (!draft) return { status: 404, body: { error: 'no such draft' } };
      dossier = draft;
      if (draft.prd === null) {
        const existing = keyed();
        if (existing) {
          // Numbered to a key already taken: the draft merges into that dossier, and goes.
          existing.versions.push(...draft.versions);
          existing.claudeSessionId = draft.claudeSessionId ?? existing.claudeSessionId;
          dossiers.delete(draft.id);
          dossier = existing;
        } else {
          draft.prd = prd;
        }
      }
    } else {
      dossier = keyed();
      if (!dossier) {
        const id = `dossier-${nextId++}`;
        dossier = { id, repo: home, prd, title: title.trim(), claudeSessionId: null, versions: [] };
        dossiers.set(id, dossier);
      }
    }
    dossier.title = title.trim();
    const added: { kind: string; version: number }[] = [];
    const unchanged: string[] = [];
    for (const { kind, content } of artifacts) {
      const ofKind = dossier.versions.filter((v) => v.kind === kind);
      const hash = sha256(content);
      if (ofKind.at(-1)?.sha256 === hash) {
        unchanged.push(kind);
      } else {
        dossier.versions.push({ kind, content, sha256: hash });
        added.push({ kind, version: ofKind.length + 1 });
      }
    }
    return { status: 200, body: dossierReply(dossier, { added, unchanged }) };
  }

  async function route(method: string | undefined, path: string, body: Json, request: IncomingMessage, response: ServerResponse, raw: string): Promise<ServerResponse | undefined> {
    let match: RegExpExecArray | null;
    if (method === 'POST' && path === '/api/ask/token') {
      const grant = textField(body, 'refresh_token');
      if (grant && refresh.has(grant)) {
        refresh.delete(grant);
        return json(response, 200, issueTokens());
      }
      const code = textField(body, 'code');
      if (code && oneTimeCodes.has(code)) {
        oneTimeCodes.delete(code);
        return json(response, 200, issueTokens());
      }
      return json(response, 401, { error: 'invalid grant' });
    }
    const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (denied || !bearer || !access.has(bearer)) return json(response, 401, { error: 'unauthorized' });

    if (method === 'POST' && path === '/api/dossiers') {
      const dossier = openDossier(body);
      return dossier ? json(response, 201, dossierReply(dossier)) : json(response, 400, { error: 'malformed draft' });
    }
    if (method === 'POST' && path === '/api/dossiers/push') {
      const { status, body: reply } = pushDossier(body, raw);
      return json(response, status, reply);
    }
    if (method === 'GET' && path === '/api/business' && business) {
      const repo = new URL(String(request.url), 'http://fake').searchParams.get('repo') ?? '';
      if (!REPO.test(repo)) return json(response, 400, { error: '`repo` must be the repository as owner/name.' });
      const { status = 200, body: reply } = business(repo);
      return json(response, status, reply);
    }
    if (method === 'POST' && path === '/api/business/citations' && cite) {
      const { status = 200, body: reply } = cite(body);
      return json(response, status, reply);
    }
    if (method === 'POST' && path === '/api/business/claims' && claim) {
      const { status = 200, body: reply } = claim(body);
      return json(response, status, reply);
    }
    if (method === 'GET' && path === '/api/ask/workspace' && place) {
      const repo = new URL(String(request.url), 'http://fake').searchParams.get('repo') ?? '';
      if (!REPO.test(repo)) return json(response, 400, { error: '`repo` must be the repository as owner/name.' });
      return json(response, 200, place(repo));
    }
    if (method === 'POST' && path === '/api/ask/heartbeat') {
      if (!isHeartbeat(body)) return json(response, 400, { error: 'malformed heartbeat' });
      const { status = 204, delayMs = 0 } = heartbeat(body) ?? {};
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (status === 204) heartbeats.push(body);
      if (response.destroyed) return undefined;
      response.writeHead(status);
      return response.end();
    }
    if (method === 'POST' && path === '/api/ask/sessions') {
      return json(response, 200, openSession(textField(body, 'title'), propertyOf(body, 'context') ?? null));
    }
    if (method === 'POST' && (match = /^\/api\/ask\/sessions\/([^/]+)\/close$/.exec(path))) {
      const id = String(match[1]);
      if (!sessions.has(id)) return json(response, 404, { error: 'not found' });
      closeSession(id);
      return json(response, 200, {});
    }
    if (method === 'POST' && (match = /^\/api\/ask\/sessions\/([^/]+)\/rounds$/.exec(path))) {
      const session = sessions.get(String(match[1]));
      if (!session) return json(response, 404, { error: 'not found' });
      if (session.status === 'closed') return json(response, 409, { error: 'session closed' });
      const questions = propertyOf(body, 'questions');
      if (!Array.isArray(questions)) return json(response, 400, { error: 'questions' });
      const round: Round = {
        id: `round-${nextId++}`, sessionId: session.id, questions, context: propertyOf(body, 'context') ?? null, lead: propertyOf(body, 'lead') ?? null,
        status: 'open', answers: null, answeredVia: null,
      };
      rounds.set(round.id, round);
      const given = answer(round);
      if (given) answerRound(round.id, given);
      return json(response, 200, { roundId: round.id });
    }
    if ((match = /^\/api\/ask\/rounds\/([^/]+)\/(wait|answers|abandon)$/.exec(path))) {
      const round = rounds.get(String(match[1]));
      if (!round) return json(response, 404, { error: 'not found' });
      const [, , action] = match;
      if (method === 'GET' && action === 'wait') {
        if (waitResult(round).status === 'open') {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, holdMs);
            const wake = () => { clearTimeout(timer); resolve(); };
            waiters.set(round.id, [...(waiters.get(round.id) ?? []), wake]);
            response.on('close', wake);
          });
        }
        return json(response, 200, waitResult(round));
      }
      if (method === 'POST' && action === 'answers') {
        answerRound(round.id, propertyOf(body, 'answers'), propertyOf(body, 'via'));
        return json(response, 200, {});
      }
      if (method === 'POST' && action === 'abandon') {
        round.status = 'abandoned';
        settle(round.id);
        return json(response, 200, {});
      }
    }
    return json(response, 404, { error: 'no such call' });
  }

  async function serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(String(request.url), 'http://fake').pathname;
    const raw = await readText(request);
    const body = parseBody(raw);
    const call: Call = { method: request.method, path, body, authorization: request.headers.authorization ?? null };
    calls.push(call);
    onCall(call);
    try {
      await route(request.method, path, body, request, response, raw);
    } catch (error) {
      json(response, 500, { error: messageOf(error) });
    }
  }

  const server = createServer((request, response) => {
    void serve(request, response);
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('the fake ask server listens on no port');
  const bound = address.port;
  base = `http://127.0.0.1:${bound}`;

  return {
    url: base,
    host: `127.0.0.1:${bound}`,
    port: bound,
    calls,
    sessions,
    rounds,
    /** Every heartbeat accepted, its body as sent. */
    heartbeats,
    /** Every dossier, by id: `{ id, repo, prd, title, claudeSessionId, versions: [{ kind, content, sha256 }] }`. */
    dossiers,
    openSession,
    answerRound,
    closeSession,
    /** Every access token issued so far stops working; the refresh tokens still do. */
    expireAccess: () => { access.clear(); },
    /** Every refresh token stops working as well. */
    expireRefresh: () => { refresh.clear(); },
    /** Every call but the token exchange gets a 401, even with a token the exchange just issued. */
    denyAccess: () => { denied = true; },
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => { resolve(); });
    }),
  };
}

function flag<T>(argv: string[], name: string, fallback: T): string | T | undefined {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
}

const script = process.argv[1];
const invoked = script !== undefined && script !== '' && realpathSync(script) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) {
  const argv = process.argv.slice(2);
  const mode = flag(argv, 'answer', 'first');
  const server = await startFakeAskServer({
    port: Number(flag(argv, 'port', 0)),
    holdMs: 50_000,
    accessToken: flag(argv, 'token', 'access-1'),
    answer: mode === 'first' ? (round) => firstOptionAnswers(round.questions) : () => null,
    onCall: (call) => { process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...call })}\n`); },
  });
  const { id } = server.openSession('tracer');
  process.stdout.write(`${JSON.stringify({ url: server.url, host: server.host, sessionId: id, accessToken: flag(argv, 'token', 'access-1'), refreshToken: 'refresh-1' })}\n`);
}
