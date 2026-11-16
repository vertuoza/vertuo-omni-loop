import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { overturnMission, type MissionsDeps } from './missions.controller';
import { ADA, BEN, DAN, fakeMissionsDb, RUNNING } from './missions.fake';
import { missionsService, NOT_YOURS } from './missions.service';

// `omni mission overturn` (PRD 2896 s11): the service adds the person's overturn beside the fleet's decision, which stays as recorded,
// drops the PRD from the branch when it had joined, and the route serves it to the terminal's bearer token.

const NOW = new Date('2027-01-22T10:00:00.000Z');
const at = NOW.toISOString();

/** Mission 42 at alone; the fleet approved PRD 7 (on the branch) and answered s1-01 of PRD 8 (not on it). */
async function decided() {
  const db = fakeMissionsDb({ owners: [BEN.id], fleetLevel: 'alone' });
  const service = missionsService(db.writer, { now: () => NOW });
  await service.setLevel(RUNNING, 'alone', BEN, db.reader(BEN));
  db.events.push(
    { mission: RUNNING, kind: 'decided', actor: 'agent', sentence: 'The committee approved PRD 7: pm yes, architect yes, reviewer yes.', at, prd: parsePrd(7) },
    { mission: RUNNING, kind: 'prd-joined', actor: 'agent', sentence: 'PRD 7 joined.', at, prd: parsePrd(7) },
    { mission: RUNNING, kind: 'decided', actor: 'agent', sentence: 'The committee answered s1-01 of PRD 8 with option A: pm yes, architect yes, reviewer yes.', at, prd: parsePrd(8) },
  );
  return { db, service };
}
const body = (decision: string) => ({ repo: 'acme/shop', mission: 42, decision });

describe('the service overturns a decision', () => {
  it('adds the person\'s event beside the decision, drops a PRD that had joined, and wakes the job', async () => {
    const { db, service } = await decided();
    expect(await service.overturn(body('7'), ADA, db.reader(ADA))).toEqual({
      ok: true,
      value: { overturn: { mission: RUNNING, branch: 'mission/42-pay-online', decision: '7', prd: 7, onBranch: true } },
    });
    expect(db.events.filter((event) => event.kind === 'decided')).toHaveLength(2);
    expect(db.events.find((event) => event.kind === 'overturned')).toEqual({ mission: RUNNING, kind: 'overturned', actor: 'ada', prd: 7, at, sentence: 'ada overturned fleet decision 7: its approval no longer counts for this mission.' });
    expect(db.events.at(-1)).toMatchObject({ kind: 'drop-asked-keep', actor: 'ada', prd: 7 });
    expect(db.jobs).toHaveLength(1);
  });

  it('reopens an answer for the person, with no drop for a PRD that was not on the branch', async () => {
    const { db, service } = await decided();
    expect(await service.overturn(body('8/s1-01'), ADA, db.reader(ADA))).toMatchObject({ ok: true, value: { overturn: { decision: '8/s1-01', branch: null, onBranch: false } } });
    expect(db.events.some((event) => event.kind === 'drop-asked-keep')).toBe(false);
  });

  it('refuses a decision the fleet did not carry, one overturned already, a stranger, no login and a mission below alone', async () => {
    const { db, service } = await decided();
    expect(await service.overturn(body('9'), ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict', error: expect.stringContaining('carried no decision 9') as string });
    await service.overturn(body('7'), ADA, db.reader(ADA));
    expect(await service.overturn(body('7'), BEN, db.reader(BEN))).toMatchObject({ ok: false, kind: 'conflict', error: 'ada overturned decision 7 already.' });
    expect(await service.overturn(body('8/s1-01'), DAN, db.reader(DAN))).toMatchObject({ ok: false, kind: 'forbidden', error: NOT_YOURS });
    expect(await service.overturn(body('8/s1-01'), { id: ADA.id, login: null }, db.reader(ADA))).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await service.overturn({ ...body('7'), mission: 41 }, ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict', error: expect.stringContaining('decides nothing') as string });
  });
});

describe('POST /api/missions/overturn', () => {
  const request = (payload: unknown, authorization: string | null = 'Bearer t') =>
    new Request('https://omni.example/api/missions/overturn', { method: 'POST', headers: authorization === null ? {} : { authorization }, body: JSON.stringify(payload) });

  async function served() {
    const { db, service } = await decided();
    const deps: MissionsDeps = { session: null, service, bearer: (header) => Promise.resolve(header === null ? null : { caller: ADA, reader: db.reader(ADA) }), log: () => undefined };
    return { db, deps };
  }

  it('answers 200 with what changed, never cached', async () => {
    const { db, deps } = await served();
    const res = await overturnMission(request(body('8/s1-01')), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ overturn: { mission: RUNNING, branch: null, decision: '8/s1-01', prd: 8, onBranch: false } });
    expect(db.events.at(-1)?.kind).toBe('overturned');
  });

  it('answers 401 with no token, 400 to a body that is none, 409 to a decision not carried, 503 with no database', async () => {
    const { deps } = await served();
    expect((await overturnMission(request(body('7'), null), deps)).status).toBe(401);
    expect((await overturnMission(request({ repo: 'acme/shop', mission: 42, decision: 'seven' }), deps)).status).toBe(400);
    expect((await overturnMission(request(body('9')), deps)).status).toBe(409);
    expect((await overturnMission(request({}), { session: null, service: null, bearer: null, log: () => undefined })).status).toBe(503);
  });
});
