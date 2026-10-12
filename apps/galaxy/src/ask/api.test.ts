import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { abandonRound, addAttachment, addRound, answerRound, categorizeRound, closeSession, deleteSession, LEAD_MAX_BYTES, removeAttachment, LEAD_NOTE_BYTES, openSession, shareRound, waitRound, whereQuestionsGo, type AskDeps, type CookieSession } from './api';
import type { JevOutcome } from '../jev/client';
import type { JevDecideDeps } from '../jev/resolve';
import type { JevCall, JevMode } from '../jev/store';
import type { Category, ClassifyInput } from './classify';
import { categoryThroughJev } from './classify-jev';
import type { Placement } from './cli-code';
import { askStore } from './store';
import { FAKE_WORKSPACE, fakeSupabase } from './store.fake';

vi.mock('server-only', () => ({}));

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
// Dan belongs to Ada's workspace too, under the arcade name he picked there.
const DAN = { id: '00000000-0000-4000-8000-0000000000d1', email: 'dan@vertuoza.com', name: 'DAN' };
// Eve, of no Vertuoza address, belongs to no workspace.
const EVE = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com', workspaces: [] };
// Ada and Bob belong to one workspace (the fake's default), Carl to another.
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: ['00000000-0000-4000-8000-00000000aced'] };
const START = Date.parse('2026-09-26T09:00:00Z');
const HOUR = 60 * 60 * 1000;
const MISSING = '00000000-0000-4000-8000-00000000ffff';
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';

// AskUserQuestion's input, as Claude sends it: stored and returned exactly as given.
const QUESTIONS = [
  {
    question: 'Which storage should the sessions use?',
    header: 'Storage',
    multiSelect: false,
    options: [
      { label: 'Postgres (Recommended)', description: 'Row-level security per owner.', preview: 'create table ask_sessions (\n  id uuid\n);' },
      { label: 'Memory', description: 'Lost on every deploy.' },
    ],
  },
  {
    question: 'Which checks run?',
    header: 'Checks',
    multiSelect: true,
    options: [{ label: 'RLS', description: 'two JWTs' }, { label: 'Handlers', description: 'stubbed client' }],
  },
];
const ANSWERS = { 'Which storage should the sessions use?': 'Postgres (Recommended)', 'Which checks run?': 'RLS, Handlers' };

// What an answer of the API carries, checked as it is read; any other field is kept for the whole-body checks.
const Answer = z.looseObject({
  error: z.string().optional(),
  id: z.string().optional(),
  url: z.string().optional(),
  roundId: z.string().optional(),
  attachments: z.unknown().optional(),
  answeredBy: z.unknown().optional(),
});

// Any text, as a field of an expected body.
const A_STRING: unknown = expect.any(String);

type Call = { token?: string | null; body?: unknown; raw?: string; headers?: Record<string, string>; signal?: AbortSignal };

function world() {
  const clock = { now: START };
  const fake = fakeSupabase({ 'ada-token': ADA, 'bob-token': BOB, 'dan-token': DAN, 'eve-token': EVE, 'carl-token': CARL }, () => clock.now);
  const sleeps: number[] = [];
  let onSleep: (() => void) | null = null;
  // The ask-attachments bucket (PRD 620): its objects' paths, and every list or remove it was sent,
  // with how many rounds were still there at the time.
  const bucket = {
    objects: [] as string[],
    calls: [] as Array<{ op: 'list' | 'remove' | 'upload'; name: string; arg: string | string[]; rounds: number }>,
    fail: false,
    /** What an upload answers instead of storing it, when set (PRD 1318). */
    refuse: null as { message: string; statusCode: string } | null,
  };
  const storage = {
    from: (name: string) => ({
      upload(path: string, file: Blob, options: { contentType: string; upsert: boolean }) {
        bucket.calls.push({ op: 'upload', name, arg: [path, options.contentType, String(file.size), String(options.upsert)], rounds: fake.tables.ask_rounds.length });
        if (bucket.fail) return Promise.resolve({ data: null, error: { message: 'storage is down', statusCode: '500' } });
        if (bucket.refuse) return Promise.resolve({ data: null, error: bucket.refuse });
        if (bucket.objects.includes(path)) return Promise.resolve({ data: null, error: { message: 'The resource already exists', statusCode: '409' } });
        bucket.objects.push(path);
        return Promise.resolve({ data: { path }, error: null });
      },
      list(folder: string) {
        bucket.calls.push({ op: 'list', name, arg: folder, rounds: fake.tables.ask_rounds.length });
        if (bucket.fail) return Promise.resolve({ data: null, error: { message: 'storage is down' } });
        return Promise.resolve({ data: bucket.objects.filter((o) => o.startsWith(`${folder}/`)).map((o) => ({ name: o.slice(folder.length + 1) })), error: null });
      },
      remove(paths: string[]) {
        bucket.calls.push({ op: 'remove', name, arg: paths, rounds: fake.tables.ask_rounds.length });
        if (bucket.fail) return Promise.resolve({ data: null, error: { message: 'storage is down' } });
        bucket.objects = bucket.objects.filter((o) => !paths.includes(o));
        return Promise.resolve({ data: paths.map((p) => ({ name: p })), error: null });
      },
    }),
  };
  const deps: AskDeps = {
    // The stub answers only the query shapes the store sends, so it is not a whole Supabase client.
    connect: ((token: string) => ({ ...fake.client(token), storage })) as unknown as AskDeps['connect'],
    installLink: INSTALL,
    now: () => clock.now,
    sleep(ms) {
      sleeps.push(ms);
      clock.now += ms;
      onSleep?.();
      return Promise.resolve();
    },
  };
  const request = (method: string, path: string, { token = 'ada-token', body, raw, headers = {}, signal }: Call = {}) =>
    new Request(`https://ask.example${path}`, {
      method,
      signal: signal ?? null,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', ...headers },
      body: raw ?? (body === undefined ? null : JSON.stringify(body)),
    });
  /** The deps of a page signed in by cookie as the person `token` names, or signed out with null
   * (PRD 1318, s3): a request with no Authorization header reads it. */
  const byCookie = (token: string | null): AskDeps => ({
    ...deps,
    cookie: () => {
      const person = token === null ? null : { 'ada-token': ADA, 'bob-token': BOB, 'dan-token': DAN }[token];
      if (!token || !person) return Promise.resolve(null);
      // The stub answers only the query shapes the store sends, so it is not a whole Supabase client.
      const client = { ...fake.client(token), storage } as unknown as CookieSession['client'];
      return Promise.resolve({ caller: { id: person.id, email: person.email }, client });
    },
  });
  const read = async (response: Response) => ({ status: response.status, body: Answer.parse(await response.json()) });

  async function session(token = 'ada-token') {
    const { body } = await read(await openSession(request('POST', '/api/ask/sessions', { token, body: { title: 'vertuoza/vertuo-omni-loop · feat/ask-mode' } }), deps));
    assertDefined(body.id, 'the new session\'s id');
    return body.id;
  }
  async function round(sessionId: string, token = 'ada-token') {
    const { body } = await read(await addRound(request('POST', `/api/ask/sessions/${sessionId}/rounds`, { token, body: { questions: QUESTIONS } }), sessionId, deps));
    assertDefined(body.roundId, 'the new round\'s id');
    return body.roundId;
  }
  const row = (table: 'ask_sessions' | 'ask_rounds', id: string | undefined) => {
    const found = fake.tables[table].find((r) => r.id === id);
    assertDefined(found, `${table} row ${id ?? '(no id)'}`);
    return found;
  };
  return {
    clock, fake, bucket, deps, byCookie, sleeps, request, read, session, round, row,
    whileWaiting(fn: () => void) { onSleep = fn; },
  };
}

// Every call of the contract, as a function of (request, id), for the checks every call shares.
const CALLS = [
  { name: 'POST /sessions', call: (w: ReturnType<typeof world>, c: Call) => openSession(w.request('POST', '/api/ask/sessions', { body: { title: 't' }, ...c }), w.deps) },
  { name: 'POST /sessions/:id/close', call: (w: ReturnType<typeof world>, c: Call, id = MISSING) => closeSession(w.request('POST', `/api/ask/sessions/${id}/close`, c), id, w.deps) },
  { name: 'POST /sessions/:id/rounds', call: (w: ReturnType<typeof world>, c: Call, id = MISSING) => addRound(w.request('POST', `/api/ask/sessions/${id}/rounds`, { body: { questions: QUESTIONS }, ...c }), id, w.deps) },
  { name: 'GET /rounds/:id/wait', call: (w: ReturnType<typeof world>, c: Call, id = MISSING) => waitRound(w.request('GET', `/api/ask/rounds/${id}/wait`, c), id, w.deps) },
  { name: 'POST /rounds/:id/answers', call: (w: ReturnType<typeof world>, c: Call, id = MISSING) => answerRound(w.request('POST', `/api/ask/rounds/${id}/answers`, { body: { answers: ANSWERS, via: 'terminal' }, ...c }), id, w.deps) },
  { name: 'POST /rounds/:id/abandon', call: (w: ReturnType<typeof world>, c: Call, id = MISSING) => abandonRound(w.request('POST', `/api/ask/rounds/${id}/abandon`, c), id, w.deps) },
];

describe('every ask call checks the bearer token, and leaves membership to the database', () => {
  for (const { name, call } of CALLS) {
    it(`${name}: 401 without a token, with another scheme, or with a token the Auth server refuses`, async () => {
      const w = world();
      for (const c of [{ token: null }, { token: null, headers: { authorization: 'Basic YWRhOnB3' } }, { token: 'forged-token' }]) {
        const { status, body } = await w.read(await call(w, c));
        expect(status).toBe(401);
        expect(body.error).toEqual(expect.any(String));
      }
      expect(w.fake.tables.ask_sessions).toEqual([]);
    });

    it(`${name}: lets an account of any address through, and the database refuses one in no workspace`, async () => {
      const w = world();
      const { status, body } = await w.read(await call(w, { token: 'eve-token' }));
      expect(body.error ?? '').not.toMatch(/vertuoza\.com/);
      if (name === 'POST /sessions') {
        expect(status).toBe(403);
        expect(body.error).toBe(`no workspace owns this repository yet — install the Omni App: ${INSTALL}`);
      } else {
        expect(status).toBe(404);
      }
      expect(w.fake.tables.ask_sessions).toEqual([]);
    });

    it(`${name}: 503 when no database is configured`, async () => {
      const w = world();
      const { status } = await w.read(await call({ ...w, deps: { connect: null } }, {}));
      expect(status).toBe(503);
    });
  }

  it('answers 404 for another owner\'s session or round, and for an id that is not one', async () => {
    const w = world();
    const sessionId = await w.session('ada-token');
    const roundId = await w.round(sessionId);
    for (const { name, call } of CALLS.slice(1)) {
      const id = name.includes('/sessions/') ? sessionId : roundId;
      expect((await call(w, { token: 'bob-token' }, id)).status, `${name} as another owner`).toBe(404);
      expect((await call(w, {}, MISSING)).status, `${name} for a missing id`).toBe(404);
      expect((await call(w, {}, 'not-a-uuid')).status, `${name} for a malformed id`).toBe(404);
    }
    expect(w.row('ask_sessions', sessionId).status).toBe('open');
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'open', answers: null, answered_via: null });
  });

  it('answers 500, not a guess, when the database fails', async () => {
    const w = world();
    const sessionId = await w.session();
    w.fake.state.fail = { message: 'connection reset' };
    const ask = CALLS[2];
    assertDefined(ask, 'the rounds call');
    const { status, body } = await w.read(await ask.call(w, {}, sessionId));
    expect(status).toBe(500);
    expect(body.error).toEqual(expect.any(String));
  });
});

describe('POST /api/ask/sessions', () => {
  it('opens a session owned by the caller, and answers its id and page link', async () => {
    const w = world();
    const { status, body } = await w.read(await openSession(w.request('POST', '/api/ask/sessions', { body: { title: '  vertuoza/vertuo-omni-loop · main  ' } }), w.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ id: A_STRING, url: `https://ask.example/ask/${body.id}` });
    expect(w.row('ask_sessions', body.id)).toMatchObject({ owner: ADA.id, title: 'vertuoza/vertuo-omni-loop · main', status: 'open' });
  });

  it('links to the host the caller used, behind a proxy too', async () => {
    const w = world();
    const headers = { 'x-forwarded-host': 'omni.vertuoza.example', 'x-forwarded-proto': 'https' };
    const { body } = await w.read(await openSession(w.request('POST', '/api/ask/sessions', { body: { title: 't' }, headers }), w.deps));
    expect(body.url).toBe(`https://omni.vertuoza.example/ask/${body.id}`);
  });

  it('refuses a missing, empty or overlong title, and a body that is not JSON, with 400', async () => {
    const w = world();
    for (const c of [{ body: {} }, { body: { title: '   ' } }, { body: { title: 7 } }, { body: { title: 'x'.repeat(201) } }, { raw: '{"title":' }, { body: ['t'] }]) {
      expect((await openSession(w.request('POST', '/api/ask/sessions', c), w.deps)).status).toBe(400);
    }
    expect(w.fake.tables.ask_sessions).toEqual([]);
  });

  it('refuses a body over 256 KiB with 413', async () => {
    const w = world();
    const response = await openSession(w.request('POST', '/api/ask/sessions', { body: { title: 't', pad: 'x'.repeat(300 * 1024) } }), w.deps);
    expect(response.status).toBe(413);
  });

  it('answers 403 with the database\'s reason, never 500, when the session has no workspace to go to (PRD 459)', async () => {
    const w = world();
    const open = (token: string, repo?: string) =>
      openSession(w.request('POST', '/api/ask/sessions', { token, body: { title: 't', ...(repo ? { context: { repo } } : {}) } }), w.deps);

    const unowned = await w.read(await open('eve-token', 'nobody/tools'));
    expect(unowned).toEqual({ status: 403, body: { error: `no workspace owns nobody/tools yet — install the Omni App: ${INSTALL}` } });

    // A repository another workspace owns: the database's refusal names it, and no link follows.
    w.fake.state.fail = { code: '42501', message: 'you are not a member of Globex, which owns globex/web' };
    const owned = await w.read(await open('ada-token', 'globex/web'));
    w.fake.state.fail = null;
    expect(owned).toEqual({ status: 403, body: { error: 'you are not a member of Globex, which owns globex/web' } });

    // Without an install link here, the reason goes as the database wrote it.
    const bare = await w.read(await openSession(w.request('POST', '/api/ask/sessions', { token: 'eve-token', body: { title: 't' } }), { ...w.deps, installLink: null }));
    expect(bare).toEqual({ status: 403, body: { error: 'no workspace owns this repository yet — install the Omni App' } });
    expect(w.fake.tables.ask_sessions).toEqual([]);
  });
});

describe('POST /api/ask/sessions/:id/close', () => {
  it('closes the session, and closing it again changes nothing', async () => {
    const w = world();
    const id = await w.session();
    for (let i = 0; i < 2; i += 1) {
      const { status, body } = await w.read(await closeSession(w.request('POST', `/api/ask/sessions/${id}/close`), id, w.deps));
      expect(status).toBe(200);
      expect(body).toEqual({ id, status: 'closed' });
    }
    expect(w.row('ask_sessions', id).status).toBe('closed');
  });
});

describe('POST /api/ask/sessions/:id/rounds', () => {
  it('stores the questions exactly as given, and answers the round id', async () => {
    const w = world();
    const sessionId = await w.session();
    const { status, body } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions: QUESTIONS } }), sessionId, w.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ roundId: A_STRING });
    expect(w.row('ask_rounds', body.roundId)).toMatchObject({ session_id: sessionId, questions: QUESTIONS, status: 'open', answers: null });
  });

  it('counts as a call on the session: it stays open 12 hours from now', async () => {
    const w = world();
    const sessionId = await w.session();
    w.clock.now += 11 * HOUR;
    await w.round(sessionId);
    expect(Date.parse(w.row('ask_sessions', sessionId).last_seen_at as string)).toBe(w.clock.now);
  });

  it('refuses questions that are not AskUserQuestion\'s with 400', async () => {
    const w = world();
    const sessionId = await w.session();
    for (const questions of [undefined, [], 'Which?', [{}], [{ question: '' }], [{ question: 'Which?' }, null], [{ question: 3 }]]) {
      const response = await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions } }), sessionId, w.deps);
      expect(response.status, JSON.stringify(questions)).toBe(400);
    }
    expect(w.fake.tables.ask_rounds).toEqual([]);
  });

  it('answers 409 closed for a closed session, or one idle for 12 hours', async () => {
    const w = world();
    const closed = await w.session();
    await closeSession(w.request('POST', `/api/ask/sessions/${closed}/close`), closed, w.deps);
    const idle = await w.session();
    w.clock.now += 12 * HOUR;
    for (const id of [closed, idle]) {
      const { status, body } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${id}/rounds`, { body: { questions: QUESTIONS } }), id, w.deps));
      expect(status).toBe(409);
      expect(body).toMatchObject({ status: 'closed' });
    }
    expect(w.fake.tables.ask_rounds).toEqual([]);
    expect(Date.parse(w.row('ask_sessions', idle).last_seen_at as string)).toBe(START);
  });

  it('opens a round already answered in the terminal, in one call (PRD 1180)', async () => {
    const w = world();
    const sessionId = await w.session();
    const body = { questions: QUESTIONS, answers: ANSWERS, via: 'terminal' };
    const { status, body: got } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body }), sessionId, w.deps));
    expect(status).toBe(200);
    expect(got).toEqual({ roundId: A_STRING, status: 'answered', via: 'terminal' });
    expect(w.row('ask_rounds', got.roundId)).toMatchObject({
      session_id: sessionId, questions: QUESTIONS, status: 'answered', answers: ANSWERS, answered_via: 'terminal', answered_by: ADA.id,
    });
  });

  it('opens it with only the questions answered, when one was left empty (PRD 1180)', async () => {
    const w = world();
    const sessionId = await w.session();
    const partial = { 'Which checks run?': 'RLS' };
    const { status, body } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions: QUESTIONS, answers: partial, via: 'terminal' } }), sessionId, w.deps));
    expect(status).toBe(200);
    expect(w.row('ask_rounds', body.roundId)).toMatchObject({ status: 'answered', answers: partial, answered_via: 'terminal' });
  });

  it('refuses an answer sent with the round that is not text given in the terminal, with 400, and asks nothing', async () => {
    const w = world();
    const sessionId = await w.session();
    for (const extra of [
      { answers: ANSWERS },
      { answers: ANSWERS, via: 'page' },
      { via: 'terminal' },
      { answers: {}, via: 'terminal' },
      { answers: { 'Which checks run?': ['RLS'] }, via: 'terminal' },
    ]) {
      const response = await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions: QUESTIONS, ...extra } }), sessionId, w.deps);
      expect(response.status, JSON.stringify(extra)).toBe(400);
    }
    expect(w.fake.tables.ask_rounds).toEqual([]);
  });
});

describe('a round\'s context (PRD 144)', () => {
  const CONTEXT = {
    repo: 'vertuoza/vertuo-omni-loop',
    branch: 'feat/question-history--s1',
    prd: 144,
    claudeSessionId: 'claude-session-1',
    skill: '/omni:brainstorm',
    model: 'claude-sonnet-4-6',
    tokens: { input: 1000, output: 2000, cacheRead: 0, cacheWrite: 0 },
  };
  const ask = (w: ReturnType<typeof world>, id: string, body: unknown) =>
    addRound(w.request('POST', `/api/ask/sessions/${id}/rounds`, { body }), id, w.deps);

  it('opens a session with its repo, or without a context at all', async () => {
    const w = world();
    const open = async (body: unknown) => (await w.read(await openSession(w.request('POST', '/api/ask/sessions', { body }), w.deps))).body.id as string;
    const withRepo = await open({ title: 't', context: { repo: 'vertuoza/vertuo-omni-loop' } });
    expect(w.row('ask_sessions', withRepo)).toMatchObject({ repo: 'vertuoza/vertuo-omni-loop' });
    for (const body of [{ title: 't' }, { title: 't', context: null }, { title: 't', context: { repo: null } }]) {
      expect(w.row('ask_sessions', await open(body))).toMatchObject({ repo: null });
    }
  });

  it('refuses a session context that is not one, or a repo that is not owner/name, with 400', async () => {
    const w = world();
    for (const context of ['acme/widgets', [], { repo: 7 }, { repo: '' }, { repo: 'no-slash' }, { repo: `a/${'x'.repeat(200)}` }]) {
      const response = await openSession(w.request('POST', '/api/ask/sessions', { body: { title: 't', context } }), w.deps);
      expect(response.status, JSON.stringify(context)).toBe(400);
    }
    expect(w.fake.tables.ask_sessions).toEqual([]);
  });

  it('stores the context of a round and its cost from the price table; the session keeps the branch and the Claude session', async () => {
    const w = world();
    const sessionId = await w.session();
    const { status, body } = await w.read(await ask(w, sessionId, { questions: QUESTIONS, context: CONTEXT }));
    expect(status).toBe(200);
    expect(w.row('ask_rounds', body.roundId)).toMatchObject({
      prd: 144, skill: '/omni:brainstorm', model: 'claude-sonnet-4-6', tokens: CONTEXT.tokens, cost_usd: 0.033, answered_by: null,
    });
    expect(w.row('ask_sessions', sessionId)).toMatchObject({ branch: 'feat/question-history--s1', claude_session_id: 'claude-session-1' });
  });

  it('prices an unknown model at null, and stores a round with no context, or one of nulls, as nulls', async () => {
    const w = world();
    const sessionId = await w.session();
    const unknown = (await w.read(await ask(w, sessionId, { questions: QUESTIONS, context: { ...CONTEXT, model: 'mystery-1' } }))).body.roundId;
    expect(w.row('ask_rounds', unknown)).toMatchObject({ model: 'mystery-1', cost_usd: null, tokens: CONTEXT.tokens });
    const nulls = { repo: null, branch: null, prd: null, claudeSessionId: null, skill: null, model: null, tokens: null };
    for (const body of [{ questions: QUESTIONS }, { questions: QUESTIONS, context: nulls }, { questions: QUESTIONS, context: {} }]) {
      const { status, body: sent } = await w.read(await ask(w, sessionId, body));
      expect(status).toBe(200);
      expect(w.row('ask_rounds', sent.roundId)).toMatchObject({ prd: null, skill: null, model: null, tokens: null, cost_usd: null });
    }
    // A later round that names no branch leaves the session's as it was.
    expect(w.row('ask_sessions', sessionId)).toMatchObject({ branch: 'feat/question-history--s1' });
  });

  it('refuses a malformed context with 400, and asks nothing', async () => {
    const w = world();
    const sessionId = await w.session();
    const bad = [
      'context', [], 7,
      { ...CONTEXT, prd: 0 }, { ...CONTEXT, prd: 1.5 }, { ...CONTEXT, prd: '144' },
      { ...CONTEXT, skill: 3 }, { ...CONTEXT, model: '' }, { ...CONTEXT, branch: 'x'.repeat(251) }, { ...CONTEXT, claudeSessionId: {} },
      { ...CONTEXT, repo: 'no-slash' },
      { ...CONTEXT, tokens: [] }, { ...CONTEXT, tokens: { input: 1 } }, { ...CONTEXT, tokens: { ...CONTEXT.tokens, output: -1 } },
      { ...CONTEXT, tokens: { ...CONTEXT.tokens, input: 1.5 } }, { ...CONTEXT, tokens: { ...CONTEXT.tokens, extra: 1 } },
    ];
    for (const context of bad) {
      const response = await ask(w, sessionId, { questions: QUESTIONS, context });
      expect(response.status, JSON.stringify(context)).toBe(400);
    }
    expect(w.fake.tables.ask_rounds).toEqual([]);
  });
});

describe('a round\'s lead (PRD 752)', () => {
  const ask = (w: ReturnType<typeof world>, id: string, body: unknown) =>
    addRound(w.request('POST', `/api/ask/sessions/${id}/rounds`, { body }), id, w.deps);

  it('stores the lead Claude wrote before asking, and reads it back with the round', async () => {
    const w = world();
    const sessionId = await w.session();
    const lead = '## The design\n\nA lead and a fold. <b>x</b>';
    const { status, body } = await w.read(await ask(w, sessionId, { questions: QUESTIONS, lead }));
    expect(status).toBe(200);
    expect(w.row('ask_rounds', body.roundId)).toMatchObject({ lead });
    expect(w.fake.tables.ask_rounds).toHaveLength(1);
  });

  it('opens a round without a lead, or with a null one, and stores none', async () => {
    const w = world();
    const sessionId = await w.session();
    for (const sent of [{ questions: QUESTIONS }, { questions: QUESTIONS, lead: null }]) {
      const { status, body } = await w.read(await ask(w, sessionId, sent));
      expect(status).toBe(200);
      expect(w.row('ask_rounds', body.roundId).lead ?? null).toBeNull();
    }
  });

  it('takes a lead of 16 KB plus the shortened note', async () => {
    const w = world();
    const sessionId = await w.session();
    const lead = `${'é'.repeat(LEAD_MAX_BYTES / 2)}\n\n… (shortened, the rest is in the terminal)`;
    const { status, body } = await w.read(await ask(w, sessionId, { questions: QUESTIONS, lead }));
    expect(status).toBe(200);
    expect(w.row('ask_rounds', body.roundId)).toMatchObject({ lead });
  });

  it('refuses a lead that is not text, or is longer than the kit sends, with 400, and asks nothing', async () => {
    const w = world();
    const sessionId = await w.session();
    for (const lead of [7, true, [], { text: 'x' }, '', 'x'.repeat(LEAD_MAX_BYTES + 1024)]) {
      const response = await ask(w, sessionId, { questions: QUESTIONS, lead });
      expect(response.status, JSON.stringify(lead).slice(0, 40)).toBe(400);
      expect(Answer.parse(await response.json()).error).toMatch(/lead/);
    }
    expect(w.fake.tables.ask_rounds).toEqual([]);
  });

  it('is kept by a migration that adds one nullable column, bounded as this API bounds it, and changes no policy', () => {
    const migration = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261018090000_ask_round_lead.sql', import.meta.url)), 'utf8');
    const statements = migration.split('\n').filter((line) => !line.startsWith('--')).join(' ').replace(/\s+/g, ' ');
    expect(statements).toContain(`alter table public.ask_rounds add column lead text check (lead is null or octet_length(lead) between 1 and ${LEAD_MAX_BYTES + LEAD_NOTE_BYTES});`);
    expect(statements).toContain('grant insert (lead) on public.ask_rounds to authenticated;');
    expect(statements).not.toMatch(/\bpolicy\b|row level security|not null/i);
  });
});

describe('who answered (PRD 144)', () => {
  it('is the session owner for an answer the terminal recorded, whatever the body says', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const body = { answers: ANSWERS, via: 'terminal', answered_by: BOB.id, answeredBy: BOB.id };
    expect((await answerRound(w.request('POST', `/api/ask/rounds/${roundId}/answers`, { body }), roundId, w.deps)).status).toBe(200);
    expect(w.row('ask_rounds', roundId).answered_by).toBe(ADA.id);
  });

  it('is the caller for an answer the page sent', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const { askStore } = await import('./store');
    await askStore(w.fake.client('ada-token') as never).moveRound(roundId, ['open'], { status: 'answered', answers: ANSWERS, answered_via: 'page' });
    expect(w.row('ask_rounds', roundId).answered_by).toBe(ADA.id);
  });
});

describe('GET /api/ask/rounds/:id/wait', () => {
  const wait = (w: ReturnType<typeof world>, id: string, c: Call = {}) => waitRound(w.request('GET', `/api/ask/rounds/${id}/wait`, c), id, w.deps);

  it('answers answered, with the answers, as soon as the page sets them', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    w.whileWaiting(() => {
      if (w.clock.now - START >= 3000) Object.assign(w.row('ask_rounds', roundId), { status: 'answered', answers: ANSWERS, answered_via: 'page' });
    });
    const { status, body } = await w.read(await wait(w, roundId));
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'answered', answers: ANSWERS });
    expect(w.clock.now - START).toBe(3000);
  });

  it('answers answered at once for a round already answered', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    Object.assign(w.row('ask_rounds', roundId), { status: 'answered', answers: ANSWERS, answered_via: 'page' });
    expect((await w.read(await wait(w, roundId))).body).toEqual({ status: 'answered', answers: ANSWERS });
    expect(w.sleeps).toEqual([]);
  });

  it('answers open after at most 50 seconds without an answer', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const { status, body } = await w.read(await wait(w, roundId));
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'open' });
    expect(w.clock.now - START).toBe(50_000);
    expect(w.sleeps.every((ms) => ms > 0 && ms <= 1000)).toBe(true);
  });

  it('never holds longer than 50 seconds, whatever the poll interval', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const deps = { ...w.deps, pollMs: 7000 };
    await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, deps);
    expect(w.clock.now - START).toBe(50_000);
  });

  it('answers closed for a closed session, one idle for 12 hours, or one closed while waiting', async () => {
    const w = world();
    const closed = await w.session();
    const closedRound = await w.round(closed);
    await closeSession(w.request('POST', `/api/ask/sessions/${closed}/close`), closed, w.deps);
    expect((await w.read(await wait(w, closedRound))).body).toEqual({ status: 'closed' });

    const idle = await w.session();
    const idleRound = await w.round(idle);
    w.clock.now += 12 * HOUR;
    expect((await w.read(await wait(w, idleRound))).body).toEqual({ status: 'closed' });
    expect(Date.parse(w.row('ask_sessions', idle).last_seen_at as string)).toBe(START);

    const later = await w.session();
    const laterRound = await w.round(later);
    const began = w.clock.now;
    w.whileWaiting(() => {
      if (w.clock.now - began >= 5000) w.row('ask_sessions', later).status = 'closed';
    });
    expect((await w.read(await wait(w, laterRound))).body).toEqual({ status: 'closed' });
    expect(w.clock.now - began).toBe(5000);
  });

  it('answers abandoned for a round the hook gave up on', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await abandonRound(w.request('POST', `/api/ask/rounds/${roundId}/abandon`), roundId, w.deps);
    expect((await w.read(await wait(w, roundId))).body).toEqual({ status: 'abandoned' });
  });

  it('counts as a call on the session', async () => {
    const w = world();
    const sessionId = await w.session();
    const roundId = await w.round(sessionId);
    w.clock.now += 11 * HOUR;
    const asked = w.clock.now;
    await wait(w, roundId);
    expect(Date.parse(w.row('ask_sessions', sessionId).last_seen_at as string)).toBe(asked);
  });

  describe('an answer with screenshots (PRD 620)', () => {
    /** The world's deps, each client also signing links as `sign` says, and every signing recorded. */
    function signing(w: ReturnType<typeof world>, sign: (path: string) => string | null, fail = false) {
      const asked: Array<{ token: string; bucket: string; paths: string[]; expiresIn: number }> = [];
      const connect = (token: string) => ({
        ...(w.fake.client(token)),
        storage: {
          from: (bucket: string) => ({
            createSignedUrls(paths: string[], expiresIn: number) {
              asked.push({ token, bucket, paths, expiresIn });
              if (fail) return Promise.resolve({ data: null, error: { message: 'storage is down' } });
              return Promise.resolve({ data: paths.map((path) => ({ path, signedUrl: sign(path) ?? '', error: sign(path) ? null : 'Object not found' })), error: null });
            },
          }),
        },
      });
      return { asked, deps: { ...w.deps, connect: connect as unknown as AskDeps['connect'] } };
    }
    const [first, second] = QUESTIONS;
    assertDefined(first, 'the first question');
    assertDefined(second, 'the second question');
    const Q1 = first.question;
    const Q2 = second.question;

    it('hands each screenshot back by name with a 10-minute signed link, made as the caller', async () => {
      const w = world();
      const roundId = await w.round(await w.session());
      const attachments = { [Q1]: [`${roundId}/1.png`, `${roundId}/2.webp`], [Q2]: [`${roundId}/3.jpg`] };
      Object.assign(w.row('ask_rounds', roundId), { status: 'answered', answers: ANSWERS, answered_via: 'page', attachments });
      const { asked, deps } = signing(w, (path) => `https://files.example/sign/${path}?token=t`);
      const { status, body } = await w.read(await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, deps));
      expect(status).toBe(200);
      expect(body).toEqual({
        status: 'answered',
        answers: ANSWERS,
        attachments: {
          [Q1]: [
            { name: '1.png', url: `https://files.example/sign/${roundId}/1.png?token=t` },
            { name: '2.webp', url: `https://files.example/sign/${roundId}/2.webp?token=t` },
          ],
          [Q2]: [{ name: '3.jpg', url: `https://files.example/sign/${roundId}/3.jpg?token=t` }],
        },
      });
      expect(asked).toEqual([{ token: 'ada-token', bucket: 'ask-attachments', paths: [`${roundId}/1.png`, `${roundId}/2.webp`, `${roundId}/3.jpg`], expiresIn: 600 }]);
    });

    it('gives null for a link that cannot be made, and still answers', async () => {
      const w = world();
      const roundId = await w.round(await w.session());
      Object.assign(w.row('ask_rounds', roundId), {
        status: 'answered', answers: ANSWERS, answered_via: 'page', attachments: { [Q1]: [`${roundId}/1.png`, `${roundId}/2.png`] },
      });
      const one = signing(w, (path) => (path.endsWith('2.png') ? null : `https://files.example/${path}`));
      expect((await w.read(await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, one.deps))).body.attachments).toEqual({
        [Q1]: [{ name: '1.png', url: `https://files.example/${roundId}/1.png` }, { name: '2.png', url: null }],
      });
      const down = signing(w, () => 'never', true);
      const { status, body } = await w.read(await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, down.deps));
      expect(status).toBe(200);
      expect(body).toEqual({ status: 'answered', answers: ANSWERS, attachments: { [Q1]: [{ name: '1.png', url: null }, { name: '2.png', url: null }] } });
    });

    it('carries no attachments field, and signs nothing, for an answer without screenshots', async () => {
      const w = world();
      const roundId = await w.round(await w.session());
      Object.assign(w.row('ask_rounds', roundId), { status: 'answered', answers: ANSWERS, answered_via: 'page', attachments: null });
      const { asked, deps } = signing(w, () => 'https://files.example/x');
      expect((await w.read(await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, deps))).body).toEqual({ status: 'answered', answers: ANSWERS });
      Object.assign(w.row('ask_rounds', roundId), { attachments: {} });
      expect((await w.read(await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, deps))).body).toEqual({ status: 'answered', answers: ANSWERS });
      expect(asked).toEqual([]);
    });

    it('signs the screenshots of an answer that arrives while it waits', async () => {
      const w = world();
      const roundId = await w.round(await w.session());
      w.whileWaiting(() => {
        if (w.clock.now - START >= 2000) {
          Object.assign(w.row('ask_rounds', roundId), {
            status: 'answered', answers: ANSWERS, answered_via: 'page', attachments: { [Q1]: [`${roundId}/1.gif`] },
          });
        }
      });
      const { deps } = signing(w, (path) => `https://files.example/${path}`);
      const { body } = await w.read(await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, deps));
      expect(body.attachments).toEqual({ [Q1]: [{ name: '1.gif', url: `https://files.example/${roundId}/1.gif` }] });
    });
  });

  it('stops waiting when the caller hangs up', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const hangUp = new AbortController();
    w.whileWaiting(() => { if (w.clock.now - START >= 2000) hangUp.abort(); });
    const response = await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`, { signal: hangUp.signal }), roundId, w.deps);
    expect(response.status).toBe(200);
    expect(w.clock.now - START).toBe(2000);
  });
});

describe('POST /api/ask/rounds/:id/answers', () => {
  const answer = (w: ReturnType<typeof world>, id: string, body: unknown, token = 'ada-token') =>
    answerRound(w.request('POST', `/api/ask/rounds/${id}/answers`, { token, body }), id, w.deps);

  it('records an answer given in the terminal: answered, via the terminal', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const { status, body } = await w.read(await answer(w, roundId, { answers: ANSWERS, via: 'terminal' }));
    expect(status).toBe(200);
    expect(body).toEqual({ id: roundId, status: 'answered', via: 'terminal' });
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'answered', answers: ANSWERS, answered_via: 'terminal' });
  });

  it('records it on a round the hook abandoned: the page shows it tagged terminal', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await abandonRound(w.request('POST', `/api/ask/rounds/${roundId}/abandon`), roundId, w.deps);
    expect((await answer(w, roundId, { answers: ANSWERS, via: 'terminal' })).status).toBe(200);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'answered', answered_via: 'terminal' });
  });

  it('records it on a round whose session closed while the hook waited (PRD 1180)', async () => {
    const w = world();
    const sessionId = await w.session();
    const roundId = await w.round(sessionId);
    await closeSession(w.request('POST', `/api/ask/sessions/${sessionId}/close`), sessionId, w.deps);
    expect((await answer(w, roundId, { answers: ANSWERS, via: 'terminal' })).status).toBe(200);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'answered', answers: ANSWERS, answered_via: 'terminal' });
  });

  it('records only the questions answered, when one was left empty (PRD 1180)', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const partial = { 'Which checks run?': 'RLS' };
    expect((await answer(w, roundId, { answers: partial, via: 'terminal' })).status).toBe(200);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'answered', answers: partial, answered_via: 'terminal' });
  });

  it('leaves a round answered on the page as it is, with 409', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    Object.assign(w.row('ask_rounds', roundId), { status: 'answered', answers: ANSWERS, answered_via: 'page' });
    const { status, body } = await w.read(await answer(w, roundId, { answers: { 'Which checks run?': 'RLS' }, via: 'terminal' }));
    expect(status).toBe(409);
    expect(body).toMatchObject({ status: 'answered' });
    expect(w.row('ask_rounds', roundId)).toMatchObject({ answers: ANSWERS, answered_via: 'page' });
  });

  it('refuses anything but text answers given in the terminal, with 400', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    for (const body of [
      { answers: ANSWERS },
      { answers: ANSWERS, via: 'page' },
      { via: 'terminal' },
      { answers: {}, via: 'terminal' },
      { answers: ['RLS'], via: 'terminal' },
      { answers: { 'Which checks run?': ['RLS'] }, via: 'terminal' },
    ]) {
      expect((await answer(w, roundId, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'open', answers: null, answered_via: null });
  });
});

describe('POST /api/ask/rounds/:id/abandon', () => {
  const abandon = (w: ReturnType<typeof world>, id: string) => abandonRound(w.request('POST', `/api/ask/rounds/${id}/abandon`), id, w.deps);

  it('marks the round abandoned, with no answer, and again changes nothing', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    for (let i = 0; i < 2; i += 1) {
      const { status, body } = await w.read(await abandon(w, roundId));
      expect(status).toBe(200);
      expect(body).toEqual({ id: roundId, status: 'abandoned' });
    }
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'abandoned', answers: null, answered_via: null });
  });

  it('leaves an answered round answered, with 409', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    Object.assign(w.row('ask_rounds', roundId), { status: 'answered', answers: ANSWERS, answered_via: 'page' });
    const { status, body } = await w.read(await abandon(w, roundId));
    expect(status).toBe(409);
    expect(body).toMatchObject({ status: 'answered' });
    expect(w.row('ask_rounds', roundId).status).toBe('answered');
  });
});

describe('DELETE /api/ask/sessions/:id (PRD 144)', () => {
  const remove = (w: ReturnType<typeof world>, id: string, token: string | null = 'ada-token') =>
    deleteSession(w.request('DELETE', `/api/ask/sessions/${id}`, { token }), id, w.deps);

  it('deletes the owner\'s session and its rounds, open or closed long ago', async () => {
    const w = world();
    const sessionId = await w.session();
    const roundId = await w.round(sessionId);
    await closeSession(w.request('POST', `/api/ask/sessions/${sessionId}/close`), sessionId, w.deps);
    w.clock.now += 8 * 24 * HOUR;
    expect(w.row('ask_sessions', sessionId)).toBeDefined();
    const { status, body } = await w.read(await remove(w, sessionId));
    expect(status).toBe(200);
    expect(body).toEqual({ id: sessionId, deleted: true });
    expect(w.fake.tables.ask_sessions.find((s) => s.id === sessionId)).toBeUndefined();
    expect(w.fake.tables.ask_rounds.find((r) => r.id === roundId)).toBeUndefined();
  });

  it('refuses a member of the workspace who is not the owner with 403, and keeps the session', async () => {
    const w = world();
    const sessionId = await w.session();
    await w.round(sessionId);
    const { status, body } = await w.read(await remove(w, sessionId, 'bob-token'));
    expect(status).toBe(403);
    expect(body.error).toMatch(/owner/);
    expect(w.row('ask_sessions', sessionId)).toBeDefined();
    expect(w.fake.tables.ask_rounds).toHaveLength(1);
  });

  it('answers 404 to an account of another workspace, and for an id that is missing or not one', async () => {
    const w = world();
    const sessionId = await w.session();
    expect((await remove(w, sessionId, 'carl-token')).status).toBe(404);
    expect((await remove(w, MISSING)).status).toBe(404);
    expect((await remove(w, 'not-a-uuid')).status).toBe(404);
    expect(w.row('ask_sessions', sessionId)).toBeDefined();
  });

  it('checks the bearer token like every other call, and reads as missing to an account in no workspace', async () => {
    const w = world();
    const sessionId = await w.session();
    expect((await remove(w, sessionId, null)).status).toBe(401);
    expect((await remove(w, sessionId, 'eve-token')).status).toBe(404);
    expect((await remove({ ...w, deps: { connect: null } }, sessionId)).status).toBe(503);
    expect(w.row('ask_sessions', sessionId)).toBeDefined();
  });

  describe('its screenshots (PRD 620)', () => {
    it('removes every object under its rounds\' folders from the bucket, before it deletes the rows', async () => {
      const w = world();
      const sessionId = await w.session();
      const first = await w.round(sessionId);
      const second = await w.round(sessionId);
      const other = await w.round(await w.session());
      w.bucket.objects = [`${first}/1.png`, `${first}/2.webp`, `${second}/1.gif`, `${other}/1.png`];
      const { status, body } = await w.read(await remove(w, sessionId));
      expect(status).toBe(200);
      expect(body).toEqual({ id: sessionId, deleted: true });
      expect(w.bucket.objects).toEqual([`${other}/1.png`]);
      expect(w.bucket.calls.filter((c) => c.op === 'list').map((c) => c.arg).sort()).toEqual([first, second].sort());
      const removed = w.bucket.calls.filter((c) => c.op === 'remove');
      expect(removed).toEqual([{ op: 'remove', name: 'ask-attachments', arg: [`${first}/1.png`, `${first}/2.webp`, `${second}/1.gif`], rounds: 3 }]);
      expect(w.fake.tables.ask_rounds.map((r) => r.id)).toEqual([other]);
    });

    it('removes nothing from the bucket for a session whose rounds have no screenshots', async () => {
      const w = world();
      const sessionId = await w.session();
      await w.round(sessionId);
      w.bucket.objects = ['00000000-0000-4000-8000-000000000009/1.png'];
      expect((await remove(w, sessionId)).status).toBe(200);
      expect(w.bucket.calls.map((c) => c.op)).toEqual(['list']);
      expect(w.bucket.objects).toHaveLength(1);
    });

    it('answers 500 and keeps the session and its rounds when the screenshots cannot be removed', async () => {
      const w = world();
      const sessionId = await w.session();
      const roundId = await w.round(sessionId);
      w.bucket.objects = [`${roundId}/1.png`];
      w.bucket.fail = true;
      const { status, body } = await w.read(await remove(w, sessionId));
      expect(status).toBe(500);
      expect(body.error).toEqual(expect.any(String));
      expect(w.row('ask_sessions', sessionId)).toBeDefined();
      expect(w.row('ask_rounds', roundId)).toBeDefined();
      w.bucket.fail = false;
      expect((await remove(w, sessionId)).status).toBe(200);
      expect(w.bucket.objects).toEqual([]);
    });

    it('touches no screenshot when the caller may not delete the session', async () => {
      const w = world();
      const sessionId = await w.session();
      const roundId = await w.round(sessionId);
      w.bucket.objects = [`${roundId}/1.png`];
      expect((await remove(w, sessionId, 'bob-token')).status).toBe(403);
      expect((await remove(w, sessionId, 'carl-token')).status).toBe(404);
      expect(w.bucket.calls).toEqual([]);
      expect(w.bucket.objects).toEqual([`${roundId}/1.png`]);
    });
  });
});

describe('a round sorted by the model (PRD 144)', () => {
  const CONTEXT = { repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/question-history', prd: 144, skill: '/omni:brainstorm' };

  /** A world whose classifier is stubbed, and whose `after()` only collects its tasks. */
  function sorting(reply: () => Promise<Category | null>) {
    const w = world();
    const tasks: Array<() => Promise<void>> = [];
    const asked: ClassifyInput[] = [];
    const deps: AskDeps = {
      ...w.deps,
      classify: async (input) => { asked.push(input); return reply(); },
      later: (task) => { tasks.push(task); },
    };
    const ask = async (sessionId: string) => {
      const { status, body } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions: QUESTIONS, context: CONTEXT } }), sessionId, deps));
      expect(status).toBe(200);
      assertDefined(body.roundId, 'the new round\'s id');
      return body.roundId;
    };
    const runLater = async () => { for (const task of tasks.splice(0)) await task(); };
    return { ...w, deps, tasks, asked, ask, runLater };
  }

  it('schedules the classifier after the response: the round is created before it runs', async () => {
    const w = sorting(() => Promise.resolve('business'));
    const roundId = await w.ask(await w.session());
    expect(w.tasks).toHaveLength(1);
    expect(w.asked).toEqual([]);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null, category_by: null });

    await w.runLater();
    expect(w.asked).toEqual([{ questions: QUESTIONS, context: CONTEXT }]);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'business', category_by: 'model' });
  });

  it('leaves the round unsorted when the classifier gives nothing, and never asks twice', async () => {
    const w = sorting(() => Promise.resolve(null));
    const roundId = await w.ask(await w.session());
    await w.runLater();
    expect(w.asked).toHaveLength(1);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null, category_by: null });
  });

  it('leaves the round unsorted when the classifier or the database fails, and the task never throws', async () => {
    const w = sorting(() => Promise.reject(new Error('boom')));
    const roundId = await w.ask(await w.session());
    await expect(w.runLater()).resolves.toBeUndefined();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null });

    const v = sorting(() => Promise.resolve('product'));
    const other = await v.ask(await v.session());
    v.fake.state.fail = { message: 'connection reset' };
    await expect(v.runLater()).resolves.toBeUndefined();
    v.fake.state.fail = null;
    expect(v.row('ask_rounds', other)).toMatchObject({ category: null });
  });

  it('schedules nothing without a classifier (no OPENROUTER_API_KEY): the round stays unsorted', async () => {
    const w = world();
    const later: Array<() => Promise<void>> = [];
    const deps: AskDeps = { ...w.deps, classify: null, later: (task) => { later.push(task); } };
    const sessionId = await w.session();
    const { status, body } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions: QUESTIONS } }), sessionId, deps));
    expect(status).toBe(200);
    expect(later).toEqual([]);
    expect(w.row('ask_rounds', body.roundId)).toMatchObject({ category: null, category_by: null });
  });

  it('never overrides a member who sorted the round first', async () => {
    const w = sorting(() => Promise.resolve('architecture'));
    const roundId = await w.ask(await w.session());
    await categorizeRound(w.request('PATCH', `/api/ask/rounds/${roundId}/category`, { token: 'bob-token', body: { category: 'product' } }), roundId, w.deps);
    await w.runLater();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'product', category_by: BOB.id });
  });
});

describe('a round sorted through Jev (PRD 812)', () => {
  const CONTEXT = { repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/question-history', prd: 144, skill: '/omni:brainstorm' };
  const jevSaid = (answer: string, confidence = 0.9): JevOutcome => ({ kind: 'answered', model: 'jev-1.13.0', answer, confidence, probabilities: null, ms: 150 });
  const JEV_DOWN: JevOutcome = { kind: 'failed', reason: 'status', status: 500, message: 'TypeSafe answered 500.', ms: 80 };

  /** A world whose classifier (Haiku) says `haiku`, and whose Jev, in `mode`, says `jev`. */
  function sorting({ mode, haiku = 'business', jev = jevSaid('architecture') }: { mode: JevMode; haiku?: Category | null; jev?: JevOutcome }) {
    const w = world();
    const tasks: Array<() => Promise<void>> = [];
    const logged: Array<[string, JevCall]> = [];
    const asked: string[] = [];
    const jevDeps: JevDecideDeps = {
      settings: (_, decision) => Promise.resolve({ decision, mode, threshold: 0.5, floor: 0.4 }),
      key: () => Promise.resolve({ kind: 'key', key: 'ts_live_key' }),
      ask: (_, state) => { asked.push(String(state)); return Promise.resolve(jev); },
      log: (workspace, call) => { logged.push([workspace, call]); return Promise.resolve(); },
    };
    const deps: AskDeps = {
      ...w.deps,
      classify: () => Promise.resolve(haiku),
      decideCategory: categoryThroughJev(jevDeps),
      later: (task) => { tasks.push(task); },
    };
    const ask = async (sessionId: string) => {
      const { status, body } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions: QUESTIONS, context: CONTEXT } }), sessionId, deps));
      expect(status).toBe(200);
      assertDefined(body.roundId, 'the new round\'s id');
      return body.roundId;
    };
    const runLater = async () => { for (const task of tasks.splice(0)) await task(); };
    return { ...w, ask, runLater, logged, asked };
  }

  it('Off: stores Haiku\'s category, never asks Jev and logs nothing', async () => {
    const w = sorting({ mode: 'off' });
    const roundId = await w.ask(await w.session());
    await w.runLater();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'business', category_by: 'model' });
    expect(w.asked).toEqual([]);
    expect(w.logged).toEqual([]);
  });

  it('Shadow: stores Haiku\'s category and logs Jev\'s beside it, about the round, in the session\'s workspace', async () => {
    const w = sorting({ mode: 'shadow' });
    const roundId = await w.ask(await w.session());
    await w.runLater();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'business', category_by: 'model' });
    expect(w.asked[0]).toContain('Which storage should the sessions use?');
    expect(w.asked[0]).not.toContain('create table ask_sessions');
    expect(w.logged).toEqual([[FAKE_WORKSPACE, expect.objectContaining({
      decision: 'question-category', mode: 'shadow', outcome: 'answered', jevAnswer: 'architecture', oldAnswer: 'business',
      counted: 'business', decidedBy: 'old', ref: `round:${roundId}`,
    })]]);
  });

  it('On: stores Jev\'s category, and logs Haiku\'s beside it', async () => {
    const w = sorting({ mode: 'on' });
    const roundId = await w.ask(await w.session());
    await w.runLater();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'architecture', category_by: 'model' });
    expect(w.logged[0]?.[1]).toMatchObject({ jevAnswer: 'architecture', oldAnswer: 'business', counted: 'architecture', decidedBy: 'jev' });
  });

  it('On: stores Haiku\'s category when Jev fails or answers under the floor', async () => {
    for (const jev of [JEV_DOWN, jevSaid('architecture', 0.1)]) {
      const w = sorting({ mode: 'on', jev });
      const roundId = await w.ask(await w.session());
      await w.runLater();
      expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'business', category_by: 'model' });
      expect(w.logged[0]?.[1]).toMatchObject({ counted: 'business', decidedBy: 'old' });
    }
  });

  it('On: sorts the round even without a classifier (no OPENROUTER_API_KEY)', async () => {
    const w = world();
    const tasks: Array<() => Promise<void>> = [];
    const deps: AskDeps = {
      ...w.deps,
      classify: null,
      decideCategory: categoryThroughJev({
        settings: (_, decision) => Promise.resolve({ decision, mode: 'on', threshold: 0.5, floor: 0.4 }),
        key: () => Promise.resolve({ kind: 'key', key: 'k' }),
        ask: () => Promise.resolve(jevSaid('harness')),
        log: async () => {},
      }),
      later: (task) => { tasks.push(task); },
    };
    const sessionId = await w.session();
    const { body } = await w.read(await addRound(w.request('POST', `/api/ask/sessions/${sessionId}/rounds`, { body: { questions: QUESTIONS } }), sessionId, deps));
    for (const task of tasks.splice(0)) await task();
    expect(w.row('ask_rounds', body.roundId)).toMatchObject({ category: 'harness', category_by: 'model' });
  });
});

describe('PATCH /api/ask/rounds/:id/category (PRD 144)', () => {
  const sort = (w: ReturnType<typeof world>, id: string, body: unknown, token: string | null = 'ada-token') =>
    categorizeRound(w.request('PATCH', `/api/ask/rounds/${id}/category`, { token, body }), id, w.deps);

  it('lets any member of the workspace set one of the six, and says they set it', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    for (const [token, who, category] of [['bob-token', BOB.id, 'ux-ui'], ['ada-token', ADA.id, 'harness']] as const) {
      const { status, body } = await w.read(await sort(w, roundId, { category }, token));
      expect(status).toBe(200);
      expect(body).toEqual({ id: roundId, category, category_by: who });
      expect(w.row('ask_rounds', roundId)).toMatchObject({ category, category_by: who });
    }
  });

  it('clears it with null: unsorted again, cleared by that member', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await sort(w, roundId, { category: 'business' });
    const { status, body } = await w.read(await sort(w, roundId, { category: null }, 'bob-token'));
    expect(status).toBe(200);
    expect(body).toEqual({ id: roundId, category: null, category_by: BOB.id });
  });

  it('refuses a value outside the six with 400, and changes nothing', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await sort(w, roundId, { category: 'business' });
    for (const body of [{ category: 'design' }, { category: 'UX/UI' }, { category: 3 }, {}, { kind: 'business' }]) {
      const { status, body: sent } = await w.read(await sort(w, roundId, body));
      expect(status, JSON.stringify(body)).toBe(400);
      expect(sent.error).toMatch(/business, product, ux-ui, architecture, harness, other/);
    }
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'business', category_by: ADA.id });
  });

  it('refuses an account of another workspace with 404, like a round that is missing or not one', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect((await sort(w, roundId, { category: 'other' }, 'carl-token')).status).toBe(404);
    expect((await sort(w, MISSING, { category: 'other' })).status).toBe(404);
    expect((await sort(w, 'not-a-uuid', { category: 'other' })).status).toBe(404);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null, category_by: null });
  });

  it('checks the bearer token like every other call, and reads as missing to an account in no workspace', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect((await sort(w, roundId, { category: 'other' }, null)).status).toBe(401);
    expect((await sort(w, roundId, { category: 'other' }, 'eve-token')).status).toBe(404);
    expect((await sort({ ...w, deps: { connect: null } }, roundId, { category: 'other' })).status).toBe(503);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null });
  });

  it('answers 500, not a guess, when the database fails', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    w.fake.state.fail = { message: 'connection reset' };
    expect((await sort(w, roundId, { category: 'other' })).status).toBe(500);
  });
});

describe('POST /api/ask/rounds/:id/shares (PRD 144)', () => {
  const share = (w: ReturnType<typeof world>, id: string, body: unknown, token: string | null = 'ada-token') =>
    shareRound(w.request('POST', `/api/ask/rounds/${id}/shares`, { token, body }), id, w.deps);

  it('lets the owner share a round with a member of the session\'s workspace, and answers the link to it', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const { status, body } = await w.read(await share(w, roundId, { member: BOB.id }));
    expect(status).toBe(200);
    expect(body).toEqual({ roundId, sharedWith: BOB.id, url: `https://ask.example/ask/q/${roundId}` });
    expect(w.fake.tables.ask_shares).toEqual([expect.objectContaining({ round_id: roundId, shared_with: BOB.id, shared_by: ADA.id })]);
  });

  it('shares again without a second share, and shares an answered round too (it only reads)', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await share(w, roundId, { member: BOB.id });
    expect((await share(w, roundId, { member: BOB.id })).status).toBe(200);
    expect(w.fake.tables.ask_shares).toHaveLength(1);
    await answerRound(w.request('POST', `/api/ask/rounds/${roundId}/answers`, { body: { answers: ANSWERS, via: 'terminal' } }), roundId, w.deps);
    expect((await share(w, roundId, { member: DAN.id })).status).toBe(200);
    expect(w.fake.tables.ask_shares).toHaveLength(2);
  });

  it('refuses a member outside the session\'s workspace, the owner themself, or no member at all, with 400', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    for (const body of [{ member: CARL.id }, { member: ADA.id }, { member: MISSING }, { member: 'bob' }, {}, { with: BOB.id }]) {
      const { status, body: sent } = await w.read(await share(w, roundId, body));
      expect(status, JSON.stringify(body)).toBe(400);
      expect(sent.error).toEqual(expect.any(String));
    }
    expect(w.fake.tables.ask_shares).toEqual([]);
  });

  it('refuses a member of the workspace who is not the owner with 403', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const { status, body } = await w.read(await share(w, roundId, { member: DAN.id }, 'bob-token'));
    expect(status).toBe(403);
    expect(body.error).toMatch(/owner/);
    expect(w.fake.tables.ask_shares).toEqual([]);
  });

  it('answers 404 for an unknown round, a round of another workspace, or an id that is not one', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect((await share(w, MISSING, { member: BOB.id })).status).toBe(404);
    expect((await share(w, 'not-a-uuid', { member: BOB.id })).status).toBe(404);
    expect((await share(w, roundId, { member: BOB.id }, 'carl-token')).status).toBe(404);
    expect(w.fake.tables.ask_shares).toEqual([]);
  });

  it('checks the bearer token like every other call, and reads as missing to an account in no workspace, and answers 500 when the database fails', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect((await share(w, roundId, { member: BOB.id }, null)).status).toBe(401);
    expect((await share(w, roundId, { member: BOB.id }, 'eve-token')).status).toBe(404);
    expect((await share({ ...w, deps: { connect: null } }, roundId, { member: BOB.id })).status).toBe(503);
    w.fake.state.fail = { message: 'connection reset' };
    expect((await share(w, roundId, { member: BOB.id })).status).toBe(500);
    w.fake.state.fail = null;
    expect(w.fake.tables.ask_shares).toEqual([]);
  });
});

describe('the first answer wins (PRD 144)', () => {
  const pageAnswer = (w: ReturnType<typeof world>, token: string, roundId: string, answers: Record<string, string> = ANSWERS) =>
    askStore(w.fake.client(token) as never).moveRound(roundId, ['open'], { status: 'answered', answers, answered_via: 'page' });
  const terminal = (w: ReturnType<typeof world>, roundId: string) =>
    answerRound(w.request('POST', `/api/ask/rounds/${roundId}/answers`, { body: { answers: { 'Which checks run?': 'RLS' }, via: 'terminal' } }), roundId, w.deps);
  async function shared(w: ReturnType<typeof world>, member = BOB) {
    const roundId = await w.round(await w.session());
    await shareRound(w.request('POST', `/api/ask/rounds/${roundId}/shares`, { body: { member: member.id } }), roundId, w.deps);
    return roundId;
  }

  it('lets the member it is shared with answer an open round on the page, and the hook gets that answer', async () => {
    const w = world();
    const roundId = await shared(w);
    expect(await pageAnswer(w, 'bob-token', roundId)).toMatchObject({ status: 'answered', answered_via: 'page' });
    expect(w.row('ask_rounds', roundId)).toMatchObject({ answers: ANSWERS, answered_by: BOB.id });
    const { body } = await w.read(await waitRound(w.request('GET', `/api/ask/rounds/${roundId}/wait`), roundId, w.deps));
    expect(body).toEqual({ status: 'answered', answers: ANSWERS });
  });

  it('answers the second answer 409, naming who answered first and which way, and keeps the first', async () => {
    const w = world();
    const roundId = await shared(w, DAN);
    await pageAnswer(w, 'dan-token', roundId);
    const { status, body } = await w.read(await terminal(w, roundId));
    expect(status).toBe(409);
    expect(body).toEqual({
      error: 'This round is already answered by DAN, on the page.',
      status: 'answered',
      answeredBy: { id: DAN.id, name: 'DAN' },
      via: 'page',
    });
    expect(w.row('ask_rounds', roundId)).toMatchObject({ answers: ANSWERS, answered_by: DAN.id });
  });

  it('names a member with no arcade name by their email, and the owner too', async () => {
    const w = world();
    const roundId = await shared(w);
    await pageAnswer(w, 'bob-token', roundId);
    expect((await w.read(await terminal(w, roundId))).body.answeredBy).toEqual({ id: BOB.id, name: 'bob@vertuoza.com' });
    const own = await w.round(await w.session());
    await pageAnswer(w, 'ada-token', own);
    expect((await w.read(await terminal(w, own))).body).toMatchObject({ answeredBy: { id: ADA.id, name: 'ada@vertuoza.com' }, via: 'page' });
  });

  it('keeps the owner\'s answer when the shared member comes second', async () => {
    const w = world();
    const roundId = await shared(w);
    expect((await terminal(w, roundId)).status).toBe(200);
    expect(await pageAnswer(w, 'bob-token', roundId, { 'Which checks run?': 'Handlers' })).toBeNull();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ answers: { 'Which checks run?': 'RLS' }, answered_by: ADA.id, answered_via: 'terminal' });
  });

  it('lets nobody else answer: a member it is not shared with, or the shared member once it moved to the terminal', async () => {
    const w = world();
    const roundId = await shared(w);
    expect(await pageAnswer(w, 'dan-token', roundId)).toBeNull();
    await abandonRound(w.request('POST', `/api/ask/rounds/${roundId}/abandon`), roundId, w.deps);
    expect(await pageAnswer(w, 'bob-token', roundId)).toBeNull();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'abandoned', answers: null });
  });

  it('never lets the shared member abandon the round, or answer it as the terminal', async () => {
    const w = world();
    const roundId = await shared(w);
    const bob = askStore(w.fake.client('bob-token') as never);
    await expect(bob.moveRound(roundId, ['open'], { status: 'abandoned' })).rejects.toThrow(/row-level security/);
    await expect(bob.moveRound(roundId, ['open'], { status: 'answered', answers: ANSWERS, answered_via: 'terminal' })).rejects.toThrow(/row-level security/);
    expect(w.row('ask_rounds', roundId).status).toBe('open');
  });
});

describe('GET /api/ask/workspace?repo= (PRD 459)', () => {
  const GLOBEX = 'you are not a member of Globex, which owns globex/web';
  // repo_workspace(), as the live route asks it: acme owns acme/*, Globex owns globex/*, and Eve is in no workspace.
  const place = (userId: string, repo: string): Promise<Placement> => {
    if (userId === EVE.id) return Promise.resolve({ workspace: null, reason: `no workspace owns ${repo} yet — install the Omni App` });
    if (repo.startsWith('globex/')) return Promise.resolve({ workspace: null, reason: GLOBEX });
    return Promise.resolve({ workspace: { slug: 'acme', name: 'Acme' }, reason: null });
  };
  const ask = async (w: ReturnType<typeof world>, repo: string | null, { token = 'ada-token', deps = {} }: { token?: string; deps?: Partial<AskDeps> } = {}) => {
    const query = repo === null ? '' : `?${new URLSearchParams({ repo })}`;
    return w.read(await whereQuestionsGo(w.request('GET', `/api/ask/workspace${query}`, { token }), { ...w.deps, place, ...deps }));
  };

  it('answers the workspace a placed repository\'s questions go to', async () => {
    const w = world();
    expect(await ask(w, 'acme/api')).toEqual({ status: 200, body: { workspace: { slug: 'acme', name: 'Acme' }, reason: null } });
  });

  it('answers the database\'s reason for a refused repository, with the install link after its install hint', async () => {
    const w = world();
    expect(await ask(w, 'globex/web')).toEqual({ status: 200, body: { workspace: null, reason: GLOBEX } });
    expect(await ask(w, 'nobody/tools', { token: 'eve-token' })).toEqual({
      status: 200, body: { workspace: null, reason: `no workspace owns nobody/tools yet — install the Omni App: ${INSTALL}` },
    });
  });

  it('answers nothing known when this deployment cannot look it up', async () => {
    const w = world();
    expect(await ask(w, 'acme/api', { deps: { place: undefined } })).toEqual({ status: 200, body: { workspace: null, reason: null } });
  });

  it('answers 500 when the lookup fails', async () => {
    const w = world();
    const failing = () => Promise.reject(new Error('repo_workspace: connection reset'));
    const { status, body } = await ask(w, 'acme/api', { deps: { place: failing } });
    expect(status).toBe(500);
    expect(body.error).toEqual(expect.any(String));
  });

  it('refuses 400 without a repository of the shape owner/name', async () => {
    const w = world();
    for (const repo of [null, '', 'acme', 'acme/api/extra', 'a b/c']) {
      const { status, body } = await ask(w, repo);
      expect(status, String(repo)).toBe(400);
      expect(body.error).toMatch(/owner\/name/);
    }
  });

  it('is 401 without a valid sign-in, and 503 without a database', async () => {
    const w = world();
    expect((await ask(w, 'acme/api', { token: 'forged-token' })).status).toBe(401);
    expect((await ask(w, 'acme/api', { deps: { connect: null } })).status).toBe(503);
  });
});

describe('the ask routes', () => {
  const app = (path: string) => fileURLToPath(new URL(`../../app/api/ask/${path}/route.ts`, import.meta.url));
  const ROUTES: Array<[string, string, string]> = [
    ['sessions', 'POST', 'openSession'],
    ['sessions/[id]', 'DELETE', 'deleteSession'],
    ['sessions/[id]/close', 'POST', 'closeSession'],
    ['sessions/[id]/rounds', 'POST', 'addRound'],
    ['rounds/[id]/wait', 'GET', 'waitRound'],
    ['rounds/[id]/answers', 'POST', 'answerRound'],
    ['rounds/[id]/abandon', 'POST', 'abandonRound'],
    ['rounds/[id]/category', 'PATCH', 'categorizeRound'],
    ['rounds/[id]/shares', 'POST', 'shareRound'],
    ['rounds/[id]/attachments/[name]', 'POST', 'addAttachment'],
    ['rounds/[id]/attachments/[name]', 'DELETE', 'removeAttachment'],
    ['workspace', 'GET', 'whereQuestionsGo'],
  ];

  for (const [path, method, handler] of ROUTES) {
    it(`/api/ask/${path} serves ${method} through ${handler}, within maxDuration 60`, () => {
      const source = readFileSync(app(path), 'utf8');
      expect(source).toMatch(/^export const maxDuration = 60;$/m);
      expect(source).toMatch(new RegExp(`export (async )?function ${method}\\b`));
      expect(source).toContain(`${handler}(`);
    });
  }
});

describe('a page\'s cookie session (PRD 1318, s3)', () => {
  const page = { token: null };

  it('takes a request with no Authorization header as the person its cookie names, on every call', async () => {
    const w = world();
    const ada = w.byCookie('ada-token');
    const sessionId = await w.session();
    const roundId = await w.round(sessionId);
    const category = await w.read(await categorizeRound(w.request('PATCH', `/api/ask/rounds/${roundId}/category`, { ...page, body: { category: 'product' } }), roundId, ada));
    expect(category).toEqual({ status: 200, body: { id: roundId, category: 'product', category_by: ADA.id } });
    const shared = await w.read(await shareRound(w.request('POST', `/api/ask/rounds/${roundId}/shares`, { ...page, body: { member: BOB.id } }), roundId, ada));
    expect(shared).toEqual({ status: 200, body: { roundId, sharedWith: BOB.id, url: `https://ask.example/ask/q/${roundId}` } });
    expect((await abandonRound(w.request('POST', `/api/ask/rounds/${roundId}/abandon`, page), roundId, ada)).status).toBe(200);
    expect((await closeSession(w.request('POST', `/api/ask/sessions/${sessionId}/close`, page), sessionId, ada)).status).toBe(200);
    expect(w.row('ask_sessions', sessionId).status).toBe('closed');
    expect(await w.read(await deleteSession(w.request('DELETE', `/api/ask/sessions/${sessionId}`, page), sessionId, ada))).toEqual({ status: 200, body: { id: sessionId, deleted: true } });
    expect(w.fake.tables.ask_sessions).toEqual([]);
  });

  it('refuses a signed-out page with 401, and changes nothing', async () => {
    const w = world();
    const sessionId = await w.session();
    const roundId = await w.round(sessionId);
    const out = w.byCookie(null);
    for (const response of [
      await closeSession(w.request('POST', `/api/ask/sessions/${sessionId}/close`, page), sessionId, out),
      await deleteSession(w.request('DELETE', `/api/ask/sessions/${sessionId}`, page), sessionId, out),
      await answerRound(w.request('POST', `/api/ask/rounds/${roundId}/answers`, { ...page, body: { answers: ANSWERS, via: 'page' } }), roundId, out),
      await addAttachment(w.request('POST', `/api/ask/rounds/${roundId}/attachments/1.png`, { ...page, raw: 'png', headers: { 'content-type': 'image/png' } }), roundId, '1.png', out),
    ]) {
      expect(response.status).toBe(401);
    }
    expect(w.row('ask_sessions', sessionId).status).toBe('open');
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'open', answers: null });
    expect(w.bucket.objects).toEqual([]);
  });

  it('still reads the bearer token first when a request carries one, cookie or not', async () => {
    const w = world();
    const sessionId = await w.session();
    const asBob = await closeSession(w.request('POST', `/api/ask/sessions/${sessionId}/close`, { token: 'bob-token' }), sessionId, w.byCookie('ada-token'));
    expect(asBob.status).toBe(404);
    expect(w.row('ask_sessions', sessionId).status).toBe('open');
  });

  it('refuses another owner\'s session through the cookie as through the token: 404, and 403 on a delete', async () => {
    const w = world();
    const sessionId = await w.session();
    const bob = w.byCookie('bob-token');
    expect((await closeSession(w.request('POST', `/api/ask/sessions/${sessionId}/close`, page), sessionId, bob)).status).toBe(404);
    expect((await deleteSession(w.request('DELETE', `/api/ask/sessions/${sessionId}`, page), sessionId, bob)).status).toBe(403);
  });
});

describe('an answer given on the page (PRD 1318, s3)', () => {
  const page = { token: null };
  const answer = (w: ReturnType<typeof world>, id: string, body: unknown, token = 'ada-token') =>
    answerRound(w.request('POST', `/api/ask/rounds/${id}/answers`, { ...page, body }), id, w.byCookie(token));

  it('records it, via the page, only while the round is open', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect(await w.read(await answer(w, roundId, { answers: ANSWERS, via: 'page' }))).toEqual({ status: 200, body: { id: roundId, status: 'answered', via: 'page' } });
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'answered', answers: ANSWERS, answered_via: 'page' });
    const again = await w.read(await answer(w, roundId, { answers: { 'Which checks run?': 'RLS' }, via: 'page' }));
    expect(again).toMatchObject({ status: 409, body: { status: 'answered' } });
    expect(w.row('ask_rounds', roundId)).toMatchObject({ answers: ANSWERS });
  });

  it('leaves a round the terminal took over as it is, with 409', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await abandonRound(w.request('POST', `/api/ask/rounds/${roundId}/abandon`), roundId, w.deps);
    expect(await w.read(await answer(w, roundId, { answers: ANSWERS, via: 'page' }))).toMatchObject({ status: 409, body: { status: 'abandoned' } });
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'abandoned', answers: null });
  });

  it('records its screenshots with it, each a file of the round\'s own folder', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    const attachments = { 'Which checks run?': [`${roundId}/1.png`, `${roundId}/2.webp`] };
    expect((await answer(w, roundId, { answers: ANSWERS, via: 'page', attachments })).status).toBe(200);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'answered', answered_via: 'page', attachments });
  });

  it('refuses answers that are not text, and screenshots of another round or another name, with 400', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    for (const body of [
      { answers: {}, via: 'page' },
      { answers: ANSWERS, via: 'page', attachments: { 'Which checks run?': [`${MISSING}/1.png`] } },
      { answers: ANSWERS, via: 'page', attachments: { 'Which checks run?': [`${roundId}/6.png`] } },
      { answers: ANSWERS, via: 'page', attachments: { 'Which checks run?': `${roundId}/1.png` } },
      { answers: ANSWERS, via: 'page', attachments: [`${roundId}/1.png`] },
    ]) {
      expect((await answer(w, roundId, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(w.row('ask_rounds', roundId)).toMatchObject({ status: 'open', answers: null });
  });

  it('answers 404 for a round that is missing or no uuid', async () => {
    const w = world();
    for (const id of [MISSING, 'not-a-uuid']) expect((await answer(w, id, { answers: ANSWERS, via: 'page' })).status).toBe(404);
  });
});

describe('a screenshot uploaded by the page, one per call (PRD 1318, s3)', () => {
  const page = { token: null };
  const MB = 1024 * 1024;
  const upload = (w: ReturnType<typeof world>, id: string, name: string, bytes: number | string, type = 'image/png', headers: Record<string, string> = {}) =>
    addAttachment(
      w.request('POST', `/api/ask/rounds/${id}/attachments/${name}`, { ...page, raw: typeof bytes === 'string' ? bytes : 'x'.repeat(bytes), headers: { 'content-type': type, ...headers } }),
      id, name, w.byCookie('ada-token'),
    );

  it('stores one at or under 4 MB in the round\'s folder, as the caller, and names its path', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect(await w.read(await upload(w, roundId, '1.png', 4 * MB))).toEqual({ status: 200, body: { path: `${roundId}/1.png` } });
    expect(w.bucket.objects).toEqual([`${roundId}/1.png`]);
    expect(w.bucket.calls).toEqual([{ op: 'upload', name: 'ask-attachments', arg: [`${roundId}/1.png`, 'image/png', String(4 * MB), 'false'], rounds: 1 }]);
  });

  it('refuses one over 4 MB with 413 too-large, by its length before reading it, and by its size', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect(await w.read(await upload(w, roundId, '1.png', 'small', 'image/png', { 'content-length': String(4 * MB + 1) }))).toEqual({ status: 413, body: { error: 'too-large' } });
    expect(await w.read(await upload(w, roundId, '1.png', 4 * MB + 1))).toEqual({ status: 413, body: { error: 'too-large' } });
    expect(w.bucket.calls).toEqual([]);
  });

  it('answers 409 for one already there, and 403 when the bucket\'s rules refuse the caller', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await upload(w, roundId, '1.png', 10);
    expect(await w.read(await upload(w, roundId, '1.png', 10))).toMatchObject({ status: 409, body: { path: `${roundId}/1.png` } });
    w.bucket.refuse = { message: 'new row violates row-level security policy', statusCode: '403' };
    expect((await upload(w, roundId, '2.png', 10)).status).toBe(403);
    w.bucket.refuse = null;
    w.bucket.fail = true;
    expect((await upload(w, roundId, '3.png', 10)).status).toBe(500);
  });

  it('refuses a name or a type the bucket does not take, with 400, and a round that is no uuid with 404', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect((await upload(w, roundId, '6.png', 10)).status).toBe(400);
    expect((await upload(w, roundId, 'a.png', 10)).status).toBe(400);
    expect((await upload(w, roundId, '1.png', 10, 'image/svg+xml')).status).toBe(400);
    expect((await upload(w, 'not-a-uuid', '1.png', 10)).status).toBe(404);
    expect(w.bucket.calls).toEqual([]);
  });

  it('removes one the page dropped, as the caller', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    await upload(w, roundId, '1.png', 10);
    const removed = await removeAttachment(w.request('DELETE', `/api/ask/rounds/${roundId}/attachments/1.png`, page), roundId, '1.png', w.byCookie('ada-token'));
    expect(await w.read(removed)).toEqual({ status: 200, body: { path: `${roundId}/1.png`, removed: true } });
    expect(w.bucket.objects).toEqual([]);
    expect((await removeAttachment(w.request('DELETE', `/api/ask/rounds/${roundId}/attachments/x.png`, page), roundId, 'x.png', w.byCookie('ada-token'))).status).toBe(404);
  });
});
