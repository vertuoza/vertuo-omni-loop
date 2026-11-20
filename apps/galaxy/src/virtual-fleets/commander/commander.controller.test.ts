import { describe, expect, it } from 'vitest';
import { getCommander, postCommander, type CommanderDeps } from './commander.controller';
import { commanderService } from './commander.service';
import { fakeCommanderDb, fakeModel, NO_RAIL, GUS, MIRA, NORTHWIND, NOW, replied } from './commander.fake';
import type { ModelAnswer } from './model';

// GET and POST /api/virtual-fleets/commander (PRD 3107 s1), with the real service on the fake database and a fake model:
// signed out 401, no database 503, a malformed query or body 400, a stranger 403 (AC-9), a fleet that is not virtual
// 422, used up 429 with the state (AC-10), off 503 with the state (AC-11), no answer 502 with the question kept, and an
// answer 201 checked against the contract.

const URL_OF = (query: string) => `https://omni.test/api/virtual-fleets/commander${query}`;
const post = (body: unknown) => new Request(URL_OF(''), { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const get = (query: string) => new Request(URL_OF(query));
const ASK = { workspace: NORTHWIND, fleet: 'blue-fleet', text: 'What is PRD 2817 waiting for?' };

function deps(person: string | null, answers: readonly ModelAnswer[] = [], options: { model?: boolean; spent?: number } = {}): CommanderDeps & { logged: string[] } {
  const db = fakeCommanderDb();
  db.spendJobs(options.spent ?? 0);
  const fake = fakeModel(answers);
  const logged: string[] = [];
  return {
    logged,
    service: () => Promise.resolve(person === null ? null : commanderService({ reader: db.as(person), writer: db.writer(), model: options.model === false ? null : fake.model, rail: NO_RAIL, me: person, now: () => NOW })),
    log: (line) => { logged.push(line); },
  };
}

const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

describe('POST /api/virtual-fleets/commander', () => {
  it('answers a member\'s question with the Commander\'s reply', async () => {
    const res = await postCommander(post(ASK), deps(MIRA, [replied({ verdict: 'It waits.', claims: [{ text: 'PRD 2817 waits on a review.', refs: ['e1'] }] })]));
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await json(res);
    expect(body.question).toMatchObject({ kind: 'question', login: MIRA });
    expect(body.reply).toMatchObject({ kind: 'reply', reply: { verdict: 'It waits.', removed: 0 } });
  });

  it('refuses the signed-out, and says so with no database', async () => {
    expect((await postCommander(post(ASK), deps(null))).status).toBe(401);
    expect((await postCommander(post(ASK), { service: null, log: () => undefined })).status).toBe(503);
  });

  it('refuses a malformed body, an empty question and a fleet that is not virtual', async () => {
    expect((await postCommander(post('not json'), deps(MIRA))).status).toBe(400);
    expect((await postCommander(post({ ...ASK, text: '   ' }), deps(MIRA))).status).toBe(422);
    expect((await postCommander(post({ ...ASK, text: 'x'.repeat(2001) }), deps(MIRA))).status).toBe(422);
    expect((await postCommander(post({ ...ASK, fleet: 'beaver' }), deps(MIRA))).status).toBe(422);
  });

  it('AC-9: refuses a member of another workspace', async () => {
    const res = await postCommander(post(ASK), deps(GUS));
    expect(res.status).toBe(403);
    expect(await json(res)).toEqual({ error: 'Only a member of the workspace reads its fleet’s Commander.' });
  });

  it('AC-10 and AC-11: says why it cannot answer, with the state', async () => {
    const usedUp = await postCommander(post(ASK), deps(MIRA, [], { spent: 2_000_000 }));
    expect(usedUp.status).toBe(429);
    expect(await json(usedUp)).toMatchObject({ error: 'Tokens used up. Back at 23:00 UTC.', state: { kind: 'used-up' } });
    const off = await postCommander(post(ASK), deps(MIRA, [], { model: false }));
    expect(off.status).toBe(503);
    expect(await json(off)).toEqual({ error: 'The Commander is off: no model key.', state: { kind: 'off' } });
  });

  it('keeps the question when the model gives no answer, and logs why', async () => {
    const d = deps(MIRA, [{ ok: false, why: 'OpenRouter answered 500', tokens: 0 }]);
    const res = await postCommander(post(ASK), d);
    expect(res.status).toBe(502);
    expect(await json(res)).toMatchObject({ error: 'No answer: try again.', question: { kind: 'question', text: ASK.text } });
    expect(d.logged).toEqual(['virtual-fleets/commander: OpenRouter answered 500']);
  });

  it('answers 500 on a failure, logged', async () => {
    const logged: string[] = [];
    const res = await postCommander(post(ASK), { service: () => Promise.reject(new Error('boom')), log: (line) => { logged.push(line); } });
    expect(res.status).toBe(500);
    expect(logged).toEqual(['virtual-fleets/commander: boom']);
  });
});

describe('GET /api/virtual-fleets/commander', () => {
  it('answers a member with the tab as it opens', async () => {
    const res = await getCommander(get(`?workspace=${NORTHWIND}&fleet=blue-fleet`), deps(MIRA));
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ view: { fleet: 'blue-fleet', state: { kind: 'ready' }, messages: [] } });
  });

  it('refuses a malformed query, the signed-out and a stranger (AC-9)', async () => {
    expect((await getCommander(get('?fleet=blue-fleet'), deps(MIRA))).status).toBe(400);
    expect((await getCommander(get(`?workspace=${NORTHWIND}&fleet=blue-fleet`), deps(null))).status).toBe(401);
    const stranger = await getCommander(get(`?workspace=${NORTHWIND}&fleet=blue-fleet`), deps(GUS));
    expect(stranger.status).toBe(403);
    expect(await json(stranger)).not.toHaveProperty('view');
  });

  it('AC-11: tells a member the Commander is off with no model key', async () => {
    const res = await getCommander(get(`?workspace=${NORTHWIND}&fleet=blue-fleet`), deps(MIRA, [], { model: false }));
    expect(await json(res)).toMatchObject({ view: { state: { kind: 'off' } } });
  });
});
