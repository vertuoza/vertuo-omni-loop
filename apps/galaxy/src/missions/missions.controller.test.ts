import { describe, expect, it } from 'vitest';
import { answerBudgetStop, budgetMission, levelMission, moveMission, type MissionsDeps } from './missions.controller';
import { ADA, BEN, DAN, DELIVERED, DRAFT, fakeMissionsDb, PAUSED, RUNNING, STOP } from './missions.fake';
import { missionsService } from './missions.service';

// POST /api/missions/<id>/start|pause|resume (PRD 2842 s5), with the real service on the database in memory.

function deps(person: typeof ADA | null, options: { refusesRefresh?: boolean; owners?: readonly string[]; fleetLevel?: 'with-you' | 'own-branch' | 'alone' } = {}) {
  const db = fakeMissionsDb(options);
  const lines: string[] = [];
  const given: MissionsDeps = {
    session: () => Promise.resolve(person === null ? null : { caller: person, reader: db.reader(person) }),
    service: missionsService(db.writer, { now: () => new Date('2027-01-22T10:00:00.000Z') }),
    log: (line) => { lines.push(line); },
  };
  return { deps: given, db, lines };
}

describe('moveMission', () => {
  it('answers 200 with the mission as moved, never cached', async () => {
    const { deps: given, db } = deps(ADA);
    const res = await moveMission('start', DRAFT, given);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ mission: { id: DRAFT, status: 'running' } });
    expect(db.jobs).toHaveLength(1);
  });

  it('answers 401 when nobody is signed in, and moves nothing', async () => {
    const { deps: given, db } = deps(null);
    const res = await moveMission('start', DRAFT, given);
    expect(res.status).toBe(401);
    expect(db.missions.get(DRAFT)?.status).toBe('draft');
  });

  it('answers 403 to a person who is no member of the mission\'s workspace', async () => {
    const res = await moveMission('start', DRAFT, deps(DAN).deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only a member of the mission\'s workspace moves it.' });
  });

  it('answers 409 to a move the status does not allow and 400 to an id that is none', async () => {
    const { deps: given } = deps(ADA);
    expect((await moveMission('resume', RUNNING, given)).status).toBe(409);
    expect((await moveMission('start', 'not-an-id', given)).status).toBe(400);
  });

  it('answers 503 with no database', async () => {
    const res = await moveMission('start', DRAFT, { session: null, service: null, log: () => undefined });
    expect(res.status).toBe(503);
  });

  it('answers 500 and logs when the job cannot be refreshed', async () => {
    const { deps: given, lines } = deps(ADA, { refusesRefresh: true });
    const res = await moveMission('start', DRAFT, given);
    expect(res.status).toBe(500);
    expect(lines.join('\n')).toContain('could not refresh the mission');
  });
});

describe('levelMission', () => {
  const post = (body: unknown) => new Request('https://omni.test/api/missions/x/level', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('answers 200 with the mission at its new level, never cached', async () => {
    const { deps: given, db } = deps(ADA, { fleetLevel: 'own-branch' });
    const res = await levelMission(DRAFT, post({ level: 'own-branch' }), given);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ mission: { id: DRAFT, level: 'own-branch' } });
    expect(db.missions.get(DRAFT)?.level).toBe('own-branch');
  });

  it('answers 401 signed out, 400 to a level or an id that is none, 403 to a member who is no owner raising it', async () => {
    expect((await levelMission(DRAFT, post({ level: 'alone' }), deps(null).deps)).status).toBe(401);
    const { deps: given } = deps(ADA);
    expect((await levelMission(DRAFT, post({ level: 'sometimes' }), given)).status).toBe(400);
    expect((await levelMission(DRAFT, post('not json'), given)).status).toBe(400);
    expect((await levelMission('not-an-id', post({ level: 'alone' }), given)).status).toBe(400);
    expect((await levelMission(DRAFT, post({ level: 'alone' }), given)).status).toBe(403);
    expect((await levelMission(DRAFT, post({ level: 'alone' }), deps(DAN).deps)).status).toBe(403);
  });

  it('answers 503 with no database', async () => {
    expect((await levelMission(DRAFT, post({ level: 'alone' }), { session: null, service: null, log: () => undefined })).status).toBe(503);
  });
});

const post = (body: unknown) => new Request('http://local/x', { method: 'POST', body: JSON.stringify(body) });

// POST /api/missions/<id>/tokens (PRD 3040 s4): a draft's budget is any member's, a started mission's an owner's.
describe('budgetMission', () => {
  it('sets a draft mission\'s budget for any member, and clears it with null', async () => {
    const { deps: given } = deps(BEN);
    const res = await budgetMission(DRAFT, post({ tokens: 2_000_000 }), given);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mission: { id: DRAFT, tokens: 2_000_000 } });
    expect(await (await budgetMission(DRAFT, post({ tokens: null }), given)).json()).toEqual({ mission: { id: DRAFT, tokens: null } });
  });

  it('leaves a started mission\'s budget to an owner', async () => {
    expect((await budgetMission(RUNNING, post({ tokens: 5000 }), deps(BEN).deps)).status).toBe(403);
    expect((await budgetMission(RUNNING, post({ tokens: 5000 }), deps(ADA, { owners: [ADA.id] }).deps)).status).toBe(200);
  });

  it('refuses 0, a fraction, a body that is none, a stranger and a mission that ended', async () => {
    const { deps: given } = deps(ADA, { owners: [ADA.id] });
    for (const tokens of [0, 1.5, 1_000_000_001]) expect((await budgetMission(DRAFT, post({ tokens }), given)).status).toBe(400);
    expect((await budgetMission(DRAFT, post('nope'), given)).status).toBe(400);
    expect((await budgetMission(DRAFT, post({ tokens: 5 }), deps(DAN).deps)).status).toBe(403);
    expect((await budgetMission(DELIVERED, post({ tokens: 5 }), given)).status).toBe(409);
    expect((await budgetMission(DRAFT, post({ tokens: 5 }), deps(null).deps)).status).toBe(401);
  });
});

// POST /api/missions/stops/<stop> (PRD 3040 s4, AC-5 to AC-7): one answer, as the person; an owner alone raises.
describe('answerBudgetStop', () => {
  it('lets a member resume tomorrow, records their event once and wakes the missions the stop paused', async () => {
    const { deps: given, db } = deps(BEN);
    const res = await answerBudgetStop(STOP, post({ answer: 'tomorrow' }), given);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stop: { id: STOP, answer: 'tomorrow', raisedTo: null } });
    expect(db.events.filter((e) => e.kind === 'budget-answer').map((e) => e.actor)).toEqual(['ben']);
    expect(db.jobs.map((j) => j.payload.mission).sort()).toEqual([PAUSED, RUNNING].sort());
    const again = await answerBudgetStop(STOP, post({ answer: 'stopped' }), given);
    expect(again.status).toBe(409);
    expect(db.events.filter((e) => e.kind === 'budget-answer')).toHaveLength(1);
  });

  it('lets an owner raise the cap above the one reached, and not a member', async () => {
    expect((await answerBudgetStop(STOP, post({ answer: 'raised', tokens: 5000 }), deps(BEN).deps)).status).toBe(403);
    const owner = deps(ADA, { owners: [ADA.id] });
    expect((await answerBudgetStop(STOP, post({ answer: 'raised', tokens: 1000 }), owner.deps)).status).toBe(409);
    const res = await answerBudgetStop(STOP, post({ answer: 'raised', tokens: 5000 }), owner.deps);
    expect(await res.json()).toEqual({ stop: { id: STOP, answer: 'raised', raisedTo: 5000 } });
    expect(owner.db.events.find((e) => e.kind === 'budget-answer')?.sentence).toBe('ada raised the cap to 5k.');
  });

  it('lets a member stop the missions, saying the budget stopped them', async () => {
    const { deps: given, db } = deps(ADA);
    expect((await answerBudgetStop(STOP, post({ answer: 'stopped' }), given)).status).toBe(200);
    expect(db.events.find((e) => e.kind === 'budget-answer')?.sentence).toBe('ada stopped the missions: the budget stopped them.');
  });

  it('refuses a raise with no number, a number with no raise, a stranger, a bad id and signed out', async () => {
    const { deps: given } = deps(ADA, { owners: [ADA.id] });
    expect((await answerBudgetStop(STOP, post({ answer: 'raised' }), given)).status).toBe(400);
    expect((await answerBudgetStop(STOP, post({ answer: 'tomorrow', tokens: 5 }), given)).status).toBe(400);
    expect((await answerBudgetStop(STOP, post({ answer: 'maybe' }), given)).status).toBe(400);
    expect((await answerBudgetStop('nope', post({ answer: 'stopped' }), given)).status).toBe(400);
    expect((await answerBudgetStop(STOP, post({ answer: 'stopped' }), deps(DAN).deps)).status).toBe(403);
    expect((await answerBudgetStop(STOP, post({ answer: 'stopped' }), deps(null).deps)).status).toBe(401);
  });
});
