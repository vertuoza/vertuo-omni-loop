import { describe, expect, it } from 'vitest';
import { getCommander, postCommanderAnswer, type CommanderDeps } from './commander.controller';
import { commanderService } from './commander.service';
import { fakeCommanderDb, fakeModel, GUS, MIRA, NORTHWIND, NOW, PAUL } from './commander.fake';
import { railService } from './rail.service';
import { ACCOUNTS, fakeRailDb, ITEM_1, JOB_3E90, JOB_4F2A, JOB_GLOBEX } from './rail.fake';

// The Waiting on you rail through its routes (PRD 3107 s2), with the real services on the fake records: GET reads the
// cards with the tab, with or without a model key; POST /api/virtual-fleets/commander/answer sends a member's choice
// through the question's own answer route as them, never twice, and says when a route refused.

const ANSWER_URL = 'https://omni.test/api/virtual-fleets/commander/answer';
const answer = (body: unknown) => new Request(ANSWER_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const view = () => new Request(`https://omni.test/api/virtual-fleets/commander?workspace=${NORTHWIND}&fleet=blue-fleet`);
const PICK = { workspace: NORTHWIND, fleet: 'blue-fleet', source: 'job', id: JOB_4F2A, choice: 'Use v2' };

function setup(person: string | null, options: { model?: boolean } = {}) {
  const db = fakeCommanderDb();
  const rail = fakeRailDb();
  const calls = rail.answerers(person ?? '');
  const deps: CommanderDeps = {
    service: () => Promise.resolve(person === null ? null : commanderService({
      reader: db.as(person), writer: db.writer(), model: options.model === false ? null : fakeModel([]).model,
      rail: railService({ reader: rail.as(person), answerers: calls, now: () => NOW }), me: person, now: () => NOW,
    })),
    log: () => undefined,
  };
  return { deps, rail, calls };
}

const json = async (res: Response) => (await res.json()) as { card?: Record<string, unknown>; error?: string; view?: { cards: { id: string; answered: unknown; choices: string[] }[]; me: string | null; state: { kind: string } } };

describe('the rail with the tab', () => {
  it('AC-16: with no model key the tab is off, and the rail is there with its cards', async () => {
    const { deps } = setup(MIRA, { model: false });
    const body = await json(await getCommander(view(), deps));
    expect(body.view?.state).toEqual({ kind: 'off' });
    expect(body.view?.me).toBe(MIRA);
    expect(body.view?.cards.map((c) => c.id)).toContain(JOB_4F2A);
  });

  it('AC-13: the card holds the choices of its record; another workspace\'s questions are never read', async () => {
    const { deps } = setup(MIRA);
    const cards = (await json(await getCommander(view(), deps))).view?.cards ?? [];
    expect(cards.find((c) => c.id === JOB_4F2A)?.choices).toEqual(['Keep old API', 'Use v2']);
    expect(cards.map((c) => c.id)).not.toContain(JOB_GLOBEX);
  });
});

describe('POST /api/virtual-fleets/commander/answer', () => {
  it('AC-4: sends the member\'s choice through the job\'s own answer route, as them, and the card reads Answered by them', async () => {
    const { deps, rail, calls } = setup(MIRA);
    const res = await postCommanderAnswer(answer(PICK), deps);
    expect(res.status).toBe(200);
    expect(calls.sent).toEqual([{ route: 'job', id: JOB_4F2A, body: { answers: { 'Old quotes API or v2?': 'Use v2' } } }]);
    expect(rail.jobs.find((j) => j.job === JOB_4F2A)).toMatchObject({ answers: { 'Old quotes API or v2?': 'Use v2' }, closedBy: ACCOUNTS[MIRA] });
    expect((await json(res)).card).toMatchObject({ id: JOB_4F2A, answered: { login: MIRA, at: NOW.toISOString(), choice: 'Use v2' } });
  });

  it('AC-4: the Commander writes no answer of its own: nothing is sent but the member\'s confirmed choice', async () => {
    const { deps, calls } = setup(MIRA);
    await getCommander(view(), deps);
    expect(calls.sent).toEqual([]);
  });

  it('AC-12: a question answered on its own page by another member is not answered twice; the card reads that member', async () => {
    const { deps, rail, calls } = setup(MIRA);
    rail.answerElsewhere.job(PAUL, JOB_4F2A, { 'Old quotes API or v2?': 'Keep old API' });
    const res = await postCommanderAnswer(answer(PICK), deps);
    expect(res.status).toBe(409);
    expect(calls.sent).toEqual([]);
    expect(rail.jobs.find((j) => j.job === JOB_4F2A)?.answers).toEqual({ 'Old quotes API or v2?': 'Keep old API' });
    expect(await json(res)).toMatchObject({ error: 'This question was answered already.', card: { answered: { login: PAUL, choice: 'Keep old API' } } });
  });

  it('AC-12: answered elsewhere while the member confirmed: the route refuses, and the card reads the other answer', async () => {
    const { rail } = setup(MIRA);
    const racing = railService({
      reader: rail.as(MIRA), now: () => NOW,
      answerers: { job: (id) => Promise.resolve(rail.answerElsewhere.job(PAUL, id, { 'Old quotes API or v2?': 'Keep old API' }) && false), item: () => Promise.resolve(false) },
    });
    const served = await racing.answer({ ...PICK, source: 'job' }, MIRA);
    expect(served).toMatchObject({ ok: false, kind: 'answered', card: { answered: { login: PAUL, choice: 'Keep old API' } } });
  });

  it('answers a mission item Adopt through its own route', async () => {
    const { deps, calls } = setup(PAUL);
    const res = await postCommanderAnswer(answer({ ...PICK, source: 'item', id: ITEM_1, choice: 'Adopt' }), deps);
    expect(res.status).toBe(200);
    expect(calls.sent).toEqual([{ route: 'item', id: ITEM_1, body: { answer: 'adopted' } }]);
    expect((await json(res)).card).toMatchObject({ answered: { login: PAUL, choice: 'Adopt' } });
  });

  it('a route that refused leaves the card open and says Not sent: try again.', async () => {
    const { deps, rail } = setup(MIRA);
    rail.refuse();
    const res = await postCommanderAnswer(answer(PICK), deps);
    expect(res.status).toBe(502);
    expect(await json(res)).toMatchObject({ error: 'Not sent: try again.', card: { id: JOB_4F2A, answered: null } });
  });

  it('refuses a choice that is not the card\'s own, an answered card, and a card that is not this fleet\'s', async () => {
    const { deps, calls } = setup(MIRA);
    expect((await postCommanderAnswer(answer({ ...PICK, choice: 'Use v3' }), deps)).status).toBe(422);
    expect((await postCommanderAnswer(answer({ ...PICK, id: JOB_3E90, choice: 'Drop' }), deps)).status).toBe(409);
    expect((await postCommanderAnswer(answer({ ...PICK, id: JOB_GLOBEX, choice: 'Yes' }), deps)).status).toBe(404);
    expect(calls.sent).toEqual([]);
  });

  it('AC-9: refuses a stranger, the signed-out and a malformed body', async () => {
    expect((await postCommanderAnswer(answer(PICK), setup(GUS).deps)).status).toBe(403);
    expect((await postCommanderAnswer(answer(PICK), setup(null).deps)).status).toBe(401);
    expect((await postCommanderAnswer(answer('not json'), setup(MIRA).deps)).status).toBe(400);
    expect((await postCommanderAnswer(answer({ ...PICK, source: 'model' }), setup(MIRA).deps)).status).toBe(422);
  });
});
