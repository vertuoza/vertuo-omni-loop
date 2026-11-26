import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { sendBackFromTab, sendBackMission, type MissionsDeps } from './missions.controller';
import { ADA, BEN, DAN, fakeMissionsDb, RUNNING } from './missions.fake';
import { missionsService, NOT_YOURS } from './missions.service';

// Bug #3302: a person sends a PM product PRD that waits on them back to the PM (`omni mission send-back`, and Send back to the PM on
// the Missions tab): their own `sent-back` event, signed with their login, names the PRD and the last plan or tech decision it follows,
// which stays as recorded (BR-PRODUCT-12), and the mission is woken. Refused unless the PRD waits on a person after its review.

const NOW = new Date('2027-01-30T10:00:00.000Z');
const P28 = parseProductPrdId('omni-loop-28');
const WAITING = 'PRD omni-loop-28: the PM and the Architect did not approve one plan version in 2 rounds; approve it on its page';
const TECH_JOB = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e99';

/** Mission 42 at alone, waiting on PRD omni-loop-28 once its two rounds were spent, the Architect's review its last decision. */
async function waiting(waitingOn: string | null = WAITING) {
  const db = fakeMissionsDb({ owners: [BEN.id], fleetLevel: 'alone' });
  const service = missionsService(db.writer, { now: () => NOW });
  await service.setLevel(RUNNING, 'alone', BEN, db.reader(BEN));
  const row = db.missions.get(RUNNING);
  if (row) db.missions.set(RUNNING, { ...row, status: 'waiting', waitingOn });
  db.decisions.set(RUNNING, [
    { kind: 'plan', prd: P28, plan: 'a'.repeat(64), outcome: 'approved', why: [], job: 'pm-job' },
    { kind: 'tech', prd: P28, plan: 'a'.repeat(64), outcome: 'escalated', why: ['the export needs a retention'], job: TECH_JOB },
  ]);
  return { db, service };
}
const body = (prd = 'omni-loop-28') => ({ repo: 'acme/shop', mission: 42, prd: parseProductPrdId(prd) });

describe('the service sends a PM product PRD back to the PM', () => {
  it('records the person\'s own event naming the PRD and the decision it follows, and wakes the mission', async () => {
    const { db, service } = await waiting();
    const decided = structuredClone(db.decisions.get(RUNNING));
    expect(await service.sendBack(body(), ADA, db.reader(ADA))).toEqual({ ok: true, value: { sentBack: { mission: RUNNING, prd: P28 } } });
    expect(db.events.at(-1)).toEqual({ mission: RUNNING, kind: 'sent-back', actor: 'ada', product: P28, job: TECH_JOB, at: NOW.toISOString(), sentence: 'ada sent PRD omni-loop-28 back to the PM: one more round with the Architect\'s open points.' });
    expect(db.decisions.get(RUNNING)).toEqual(decided);
    expect(db.jobs).toHaveLength(1);
  });

  it('takes a PRD the Architect left to a person too', async () => {
    const { db, service } = await waiting('PRD omni-loop-28: the Architect left it to you: the export needs a retention; approve it on its page');
    expect(await service.sendBack(body(), ADA, db.reader(ADA))).toMatchObject({ ok: true });
  });

  it('refuses a PRD that does not wait on a person after its review, a stranger, no login and a mission below alone', async () => {
    const { db, service } = await waiting();
    expect(await service.sendBack(body('omni-loop-29'), ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict', error: expect.stringContaining('PRD omni-loop-29 does not wait on a person after its review') as string });
    expect(await service.sendBack(body(), DAN, db.reader(DAN))).toMatchObject({ ok: false, kind: 'forbidden', error: NOT_YOURS });
    expect(await service.sendBack(body(), { id: ADA.id, login: null }, db.reader(ADA))).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await service.sendBack({ ...body(), mission: 41 }, ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict', error: expect.stringContaining('runs at with-you') as string });
    expect(db.events.some((event) => event.kind === 'sent-back')).toBe(false);
  });
});

describe('POST /api/missions/send-back and /api/missions/<id>/send-back', () => {
  async function served() {
    const { db, service } = await waiting();
    const person = { caller: ADA, reader: db.reader(ADA) };
    const deps: MissionsDeps = { session: () => Promise.resolve(person), service, bearer: (header) => Promise.resolve(header === null ? null : person), log: () => undefined };
    return { db, deps };
  }
  const post = (path: string, payload: unknown, authorization: string | null = null) =>
    new Request(`https://omni.example${path}`, { method: 'POST', headers: authorization === null ? {} : { authorization }, body: JSON.stringify(payload) });

  it('the terminal\'s bearer sends it back: 200, never cached; 401 with no token, 400 to a body that is none', async () => {
    const { db, deps } = await served();
    const res = await sendBackMission(post('/api/missions/send-back', body(), 'Bearer t'), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ sentBack: { mission: RUNNING, prd: 'omni-loop-28' } });
    expect(db.events.at(-1)?.kind).toBe('sent-back');
    expect((await sendBackMission(post('/api/missions/send-back', body()), deps)).status).toBe(401);
    expect((await sendBackMission(post('/api/missions/send-back', { ...body(), prd: '28' }, 'Bearer t'), deps)).status).toBe(400);
  });

  it('the Missions tab\'s person sends it back by the mission\'s id: 200; 409 once it waits no more', async () => {
    const { db, deps } = await served();
    const res = await sendBackFromTab(RUNNING, post(`/api/missions/${RUNNING}/send-back`, { prd: 'omni-loop-28' }), deps);
    expect(res.status).toBe(200);
    expect(db.events.at(-1)).toMatchObject({ kind: 'sent-back', actor: 'ada', product: 'omni-loop-28' });
    const row = db.missions.get(RUNNING);
    if (row) db.missions.set(RUNNING, { ...row, waitingOn: null });
    expect((await sendBackFromTab(RUNNING, post(`/api/missions/${RUNNING}/send-back`, { prd: 'omni-loop-28' }), deps)).status).toBe(409);
    expect((await sendBackFromTab(RUNNING, post(`/api/missions/${RUNNING}/send-back`, {}), deps)).status).toBe(400);
  });
});
