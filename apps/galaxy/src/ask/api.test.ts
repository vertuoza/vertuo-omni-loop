import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { abandonRound, addRound, answerRound, categorizeRound, closeSession, deleteSession, openSession, shareRound, waitRound, type AskDeps } from './api';
import type { Category, ClassifyInput } from './classify';
import { askStore } from './store';
import { fakeSupabase } from './store.fake';

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
// Dan belongs to Ada's workspace too, under the arcade name he picked there.
const DAN = { id: '00000000-0000-4000-8000-0000000000d1', email: 'dan@vertuoza.com', name: 'DAN' };
const EVE = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com' };
// Ada and Bob belong to one workspace (the fake's default), Carl to another.
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: ['00000000-0000-4000-8000-00000000aced'] };
const START = Date.parse('2026-09-26T09:00:00Z');
const HOUR = 60 * 60 * 1000;
const MISSING = '00000000-0000-4000-8000-00000000ffff';

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

type Call = { token?: string | null; body?: unknown; raw?: string; headers?: Record<string, string>; signal?: AbortSignal };

function world() {
  const clock = { now: START };
  const fake = fakeSupabase({ 'ada-token': ADA, 'bob-token': BOB, 'dan-token': DAN, 'eve-token': EVE, 'carl-token': CARL }, () => clock.now);
  const sleeps: number[] = [];
  let onSleep: (() => void) | null = null;
  const deps: AskDeps = {
    // The stub answers only the query shapes the store sends, so it is not a whole Supabase client.
    connect: fake.client as unknown as AskDeps['connect'],
    now: () => clock.now,
    async sleep(ms) {
      sleeps.push(ms);
      clock.now += ms;
      onSleep?.();
    },
  };
  const request = (method: string, path: string, { token = 'ada-token', body, raw, headers = {}, signal }: Call = {}) =>
    new Request(`https://ask.example${path}`, {
      method,
      signal,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', ...headers },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  const read = async (response: Response) => ({ status: response.status, body: await response.json() });

  async function session(token = 'ada-token') {
    const { body } = await read(await openSession(request('POST', '/api/ask/sessions', { token, body: { title: 'vertuoza/vertuo-omni-loop · feat/ask-mode' } }), deps));
    return body.id as string;
  }
  async function round(sessionId: string, token = 'ada-token') {
    const { body } = await read(await addRound(request('POST', `/api/ask/sessions/${sessionId}/rounds`, { token, body: { questions: QUESTIONS } }), sessionId, deps));
    return body.roundId as string;
  }
  const row = (table: 'ask_sessions' | 'ask_rounds', id: string) => fake.tables[table].find((r) => r.id === id)!;
  return {
    clock, fake, deps, sleeps, request, read, session, round, row,
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

describe('every ask call checks the bearer token and the crew', () => {
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

    it(`${name}: 403 for an account outside the crew`, async () => {
      const w = world();
      const { status, body } = await w.read(await call(w, { token: 'eve-token' }));
      expect(status).toBe(403);
      expect(body.error).toMatch(/vertuoza\.com/);
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
    const { status, body } = await w.read(await CALLS[2].call(w, {}, sessionId));
    expect(status).toBe(500);
    expect(body.error).toEqual(expect.any(String));
  });
});

describe('POST /api/ask/sessions', () => {
  it('opens a session owned by the caller, and answers its id and page link', async () => {
    const w = world();
    const { status, body } = await w.read(await openSession(w.request('POST', '/api/ask/sessions', { body: { title: '  vertuoza/vertuo-omni-loop · main  ' } }), w.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ id: expect.any(String), url: `https://ask.example/ask/${body.id}` });
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
    expect(body).toEqual({ roundId: expect.any(String) });
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

  it('checks the bearer token and the crew like every other call', async () => {
    const w = world();
    const sessionId = await w.session();
    expect((await remove(w, sessionId, null)).status).toBe(401);
    expect((await remove(w, sessionId, 'eve-token')).status).toBe(403);
    expect((await remove({ ...w, deps: { connect: null } }, sessionId)).status).toBe(503);
    expect(w.row('ask_sessions', sessionId)).toBeDefined();
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
      return body.roundId as string;
    };
    const runLater = async () => { for (const task of tasks.splice(0)) await task(); };
    return { ...w, deps, tasks, asked, ask, runLater };
  }

  it('schedules the classifier after the response: the round is created before it runs', async () => {
    const w = sorting(async () => 'business');
    const roundId = await w.ask(await w.session());
    expect(w.tasks).toHaveLength(1);
    expect(w.asked).toEqual([]);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null, category_by: null });

    await w.runLater();
    expect(w.asked).toEqual([{ questions: QUESTIONS, context: CONTEXT }]);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'business', category_by: 'model' });
  });

  it('leaves the round unsorted when the classifier gives nothing, and never asks twice', async () => {
    const w = sorting(async () => null);
    const roundId = await w.ask(await w.session());
    await w.runLater();
    expect(w.asked).toHaveLength(1);
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null, category_by: null });
  });

  it('leaves the round unsorted when the classifier or the database fails, and the task never throws', async () => {
    const w = sorting(async () => { throw new Error('boom'); });
    const roundId = await w.ask(await w.session());
    await expect(w.runLater()).resolves.toBeUndefined();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: null });

    const v = sorting(async () => 'product');
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
    const w = sorting(async () => 'architecture');
    const roundId = await w.ask(await w.session());
    await categorizeRound(w.request('PATCH', `/api/ask/rounds/${roundId}/category`, { token: 'bob-token', body: { category: 'product' } }), roundId, w.deps);
    await w.runLater();
    expect(w.row('ask_rounds', roundId)).toMatchObject({ category: 'product', category_by: BOB.id });
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

  it('checks the bearer token and the crew like every other call', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect((await sort(w, roundId, { category: 'other' }, null)).status).toBe(401);
    expect((await sort(w, roundId, { category: 'other' }, 'eve-token')).status).toBe(403);
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

  it('checks the bearer token and the crew like every other call, and answers 500 when the database fails', async () => {
    const w = world();
    const roundId = await w.round(await w.session());
    expect((await share(w, roundId, { member: BOB.id }, null)).status).toBe(401);
    expect((await share(w, roundId, { member: BOB.id }, 'eve-token')).status).toBe(403);
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
