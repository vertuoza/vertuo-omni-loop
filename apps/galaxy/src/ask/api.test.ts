import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { abandonRound, addRound, answerRound, closeSession, openSession, waitRound, type AskDeps } from './api';
import { fakeSupabase } from './store.fake';

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const EVE = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com' };
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
  const fake = fakeSupabase({ 'ada-token': ADA, 'bob-token': BOB, 'eve-token': EVE }, () => clock.now);
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

describe('the ask routes', () => {
  const app = (path: string) => fileURLToPath(new URL(`../../app/api/ask/${path}/route.ts`, import.meta.url));
  const ROUTES: Array<[string, string, string]> = [
    ['sessions', 'POST', 'openSession'],
    ['sessions/[id]/close', 'POST', 'closeSession'],
    ['sessions/[id]/rounds', 'POST', 'addRound'],
    ['rounds/[id]/wait', 'GET', 'waitRound'],
    ['rounds/[id]/answers', 'POST', 'answerRound'],
    ['rounds/[id]/abandon', 'POST', 'abandonRound'],
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
