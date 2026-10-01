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
// In a test:   const server = await startFakeAskServer({ answer: (round) => ({ ... }) });
// By hand:     node kit/test/fake-ask-server.ts [--port <p>] [--answer first|none] [--token <t>]
//              prints one JSON line `{ url, host, sessionId, accessToken, refreshToken }`, then one
//              JSON line per call it serves.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A request body, a round, a dossier: JSON the fake reads field by field and refuses as the server does. */
type Json = any; // ts-allow: a test fake reads whatever JSON a test sends, as the real server's handlers do

/** A handler's answer: its status (200 when not given) and its body. */
type Reply = { status?: number; body: unknown };

/** What the fake records of each call. */
type Call = { method: string | undefined; path: string; body: Json; authorization: string | null };

const json = (response: ServerResponse, status: number, body?: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(body === undefined ? '' : JSON.stringify(body));
};

async function readText(request: IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of request) text += chunk;
  return text;
}

function parseBody(text: string): Json {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * The answer every question's first option gives: a multi-select takes its first two labels, joined
 * the way `AskUserQuestion` joins them.
 */
export function firstOptionAnswers(questions: Json): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const question of questions ?? []) {
    const labels = (question.options ?? []).map((option: Json) => option.label);
    answers[question.question] = question.multiSelect ? labels.slice(0, 2).join(', ') : labels[0];
  }
  return answers;
}

const HEARTBEAT_FIELDS = ['claudeSessionId', 'repo', 'work', 'ended'];

const isObject = (value: unknown): boolean => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** A heartbeat's body as the contract has it: its session, its repository, what it works on. */
function isHeartbeat(body: Json): boolean {
  if (!isObject(body) || Object.keys(body).some((key) => !HEARTBEAT_FIELDS.includes(key))) return false;
  if (typeof body.claudeSessionId !== 'string' || !body.claudeSessionId) return false;
  if (typeof body.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(body.repo)) return false;
  return (body.ended === undefined || body.ended === true) && isWork(body.work);
}

/** A heartbeat's work: null, a draft by its id, or a PRD or fix by its number. */
function isWork(work: Json): boolean {
  if (work === null) return true;
  if (!isObject(work) || Object.keys(work).length !== 2) return false;
  if (work.kind === 'draft') return typeof work.draftId === 'string' && work.draftId !== '';
  return ['prd', 'visual', 'bug'].includes(work.kind) && Number.isInteger(work.number) && work.number > 0;
}

const DOSSIER_KINDS = ['spec', 'plan', 'before-after'];
const sha256 = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex');

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
export async function startFakeAskServer({
  port = 0,
  holdMs = 50,
  accessToken = 'access-1',
  refreshToken = 'refresh-1',
  codes = [],
  email = 'person@example.com',
  answer = () => null,
  onCall = () => {},
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
  accessToken?: string;
  refreshToken?: string;
  codes?: string[];
  email?: string;
  answer?: (round: Json) => Record<string, string> | null;
  onCall?: (call: Call) => void;
  dossierBodyBytes?: number;
  artifactBytes?: number;
  place?: ((repo: string) => unknown) | null;
  business?: ((repo: string) => Reply) | null;
  cite?: ((body: Json) => Reply) | null;
  claim?: ((body: Json) => Reply) | null;
  tokenExtras?: Record<string, unknown>;
  heartbeat?: (body: Json) => { status?: number; delayMs?: number } | null | undefined;
} = {}) {
  const access = new Set([accessToken]);
  const refresh = new Set([refreshToken]);
  const oneTimeCodes = new Set(codes);
  const sessions = new Map<string, Json>();
  const rounds = new Map<string, Json>();
  const waiters = new Map<string, (() => void)[]>();
  const calls: Call[] = [];
  const dossiers = new Map<string, Json>();
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

  function openSession(title: string = 'fake session', context: unknown = null) {
    const id = `sess-${nextId++}`;
    sessions.set(id, { id, title, status: 'open', context });
    return { id, url: `${base}/ask/${id}` };
  }

  function answerRound(roundId: string, answers: unknown, via: unknown = 'page') {
    const round = rounds.get(roundId);
    Object.assign(round, { status: 'answered', answers, answeredVia: via });
    settle(roundId);
  }

  function closeSession(id: string) {
    sessions.get(id).status = 'closed';
    for (const round of rounds.values()) if (round.sessionId === id) settle(round.id);
  }

  function waitResult(round: Json) {
    if (sessions.get(round.sessionId)?.status === 'closed') return { status: 'closed' };
    if (round.status === 'answered') return { status: 'answered', answers: round.answers };
    return { status: round.status };
  }

  /** A dossier as the contract answers it. */
  const dossierReply = (dossier: Json, more: Record<string, unknown> = {}) => ({ id: dossier.id, url: `${base}/prd/${dossier.id}`, ...more });

  function openDossier(body: Json): Json {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 200 || typeof body?.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(body.repo)) return null;
    const id = `dossier-${nextId++}`;
    dossiers.set(id, {
      id, repo: body.repo.toLowerCase(), prd: null, title, claudeSessionId: body.claudeSessionId ?? null, versions: [],
    });
    return dossiers.get(id);
  }

  /** The push: `{ status, body }`, as the real server answers it. */
  function pushDossier(body: Json, raw: string): { status: number; body: unknown } {
    if (Buffer.byteLength(raw) > dossierBodyBytes) return { status: 413, body: { error: 'too large' } };
    const { repo, prd, title, draftId = null, artifacts } = body ?? {};
    const fine = typeof repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repo) && Number.isInteger(prd) && prd > 0
      && typeof title === 'string' && title.trim() && Array.isArray(artifacts)
      && artifacts.every((a: Json) => DOSSIER_KINDS.includes(a?.kind) && typeof a.content === 'string');
    if (!fine) return { status: 400, body: { error: 'malformed push' } };
    if (artifacts.some((a: Json) => Buffer.byteLength(a.content) > artifactBytes)) return { status: 413, body: { error: 'artifact too large' } };
    const home = repo.toLowerCase();
    const keyed = () => [...dossiers.values()].find((d: Json) => d.repo === home && d.prd === prd);
    let dossier: Json;
    if (draftId !== null) {
      const draft = dossiers.get(draftId);
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
      const ofKind = dossier.versions.filter((v: Json) => v.kind === kind);
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

  async function route(method: string | undefined, path: string, body: Json, request: IncomingMessage, response: ServerResponse, raw: string): Promise<unknown> {
    let match: RegExpExecArray | null;
    if (method === 'POST' && path === '/api/ask/token') {
      if (body?.refresh_token && refresh.has(body.refresh_token)) {
        refresh.delete(body.refresh_token);
        return json(response, 200, issueTokens());
      }
      if (body?.code && oneTimeCodes.has(body.code)) {
        oneTimeCodes.delete(body.code);
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
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return json(response, 400, { error: '`repo` must be the repository as owner/name.' });
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
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return json(response, 400, { error: '`repo` must be the repository as owner/name.' });
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
    if (method === 'POST' && path === '/api/ask/sessions') return json(response, 200, openSession(body?.title, body?.context ?? null));
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
      if (!Array.isArray(body?.questions)) return json(response, 400, { error: 'questions' });
      const round = {
        id: `round-${nextId++}`, sessionId: session.id, questions: body.questions, context: body.context ?? null, lead: body.lead ?? null,
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
        answerRound(round.id, body?.answers, body?.via);
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

  const server = createServer(async (request, response) => {
    const path = new URL(String(request.url), 'http://fake').pathname;
    const raw = await readText(request);
    const body = parseBody(raw);
    const call: Call = { method: request.method, path, body, authorization: request.headers.authorization ?? null };
    calls.push(call);
    onCall(call);
    try {
      await route(request.method, path, body, request, response, raw);
    } catch (error) {
      json(response, 500, { error: String((error as Json)?.message ?? error) }); // ts-allow: whatever a handler threw
    }
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  const { port: bound } = server.address() as AddressInfo; // ts-allow: a server listening on a port has an address
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
    expireAccess: () => access.clear(),
    /** Every refresh token stops working as well. */
    expireRefresh: () => refresh.clear(),
    /** Every call but the token exchange gets a 401, even with a token the exchange just issued. */
    denyAccess: () => { denied = true; },
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

function flag<T>(argv: string[], name: string, fallback: T): string | T | undefined {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) {
  const argv = process.argv.slice(2);
  const mode = flag(argv, 'answer', 'first');
  const server = await startFakeAskServer({
    port: Number(flag(argv, 'port', 0)),
    holdMs: 50_000,
    accessToken: flag(argv, 'token', 'access-1'),
    answer: mode === 'first' ? (round) => firstOptionAnswers(round.questions) : () => null,
    onCall: (call) => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...call })}\n`),
  });
  const { id } = server.openSession('tracer');
  process.stdout.write(`${JSON.stringify({ url: server.url, host: server.host, sessionId: id, accessToken: flag(argv, 'token', 'access-1'), refreshToken: 'refresh-1' })}\n`);
}
