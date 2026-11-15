import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { dropMission, type MissionsDeps } from './missions.controller';
import { ADA, BEN, DAN, DRAFT, fakeMissionsDb, RUNNING } from './missions.fake';
import { missionsService, NOT_YOURS } from './missions.service';

// `omni mission drop` (PRD 2896 s7): the service records the ask and names what goes with the PRD, and the route serves it to the
// terminal's bearer token, on the database in memory and a fixed clock.

const NOW = new Date('2027-01-22T10:00:00.000Z');
const at = NOW.toISOString();
const JOB = (id: string) => ({ kind: 'mission', key: `mission:${id}`, subject: 'acme/shop', payload: { mission: id }, lane: `mission:${id}`, delaySeconds: 0 });

/** Mission 42 at own-branch with PRDs 7, 8 and 9 on its branch; 7 and 9 share ground. */
async function onBranch() {
  const db = fakeMissionsDb({ owners: [BEN.id], territories: { 7: ['apps/shop/'], 8: ['apps/blog/'], 9: ['apps/shop/cart/'] } });
  const service = missionsService(db.writer, { now: () => NOW });
  await service.setLevel(RUNNING, 'own-branch', BEN, db.reader(BEN));
  for (const n of [7, 8, 9]) db.events.push({ mission: RUNNING, kind: 'prd-joined', actor: 'agent', sentence: `PRD ${String(n)} joined.`, at, prd: parsePrd(n) });
  return { db, service };
}
const body = (prd: number, keep = false) => ({ repo: 'acme/shop', mission: 42, prd: parsePrd(prd), keep });

describe('the service drops a PRD', () => {
  it('records the ask signed with the member\'s login, wakes the job, and names the later PRDs sharing the territory', async () => {
    const { db, service } = await onBranch();
    expect(await service.drop(body(7), ADA, db.reader(ADA))).toEqual({
      ok: true,
      value: { drop: { mission: RUNNING, branch: 'mission/42-pay-online', prd: 7, sharing: [9], dropped: [7, 9], keep: false } },
    });
    expect(db.events.at(-1)).toEqual({ mission: RUNNING, kind: 'drop-asked', actor: 'ada', prd: 7, at, sentence: 'ada asked to drop PRD 7 from mission/42-pay-online, with PRD 9.' });
    expect(db.jobs.at(-1)).toEqual(JOB(RUNNING));
  });

  it('with keep records the other kind, and still names what shares the territory', async () => {
    const { db, service } = await onBranch();
    expect(await service.drop(body(7, true), ADA, db.reader(ADA))).toMatchObject({ ok: true, value: { drop: { sharing: [9], dropped: [7], keep: true } } });
    expect(db.events.at(-1)).toMatchObject({ kind: 'drop-asked-keep', sentence: 'ada asked to drop PRD 7 from mission/42-pay-online.' });
  });

  it('refuses a PRD that is not on the branch, a person outside the workspace, one with no login, a mission at with-you and one not started', async () => {
    const { db, service } = await onBranch();
    expect(await service.drop(body(5), ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict', error: 'PRD 5 is not on mission/42-pay-online: there is nothing to drop.' });
    expect(await service.drop(body(7), DAN, db.reader(DAN))).toMatchObject({ ok: false, kind: 'forbidden', error: NOT_YOURS });
    expect(await service.drop(body(7), { id: ADA.id, login: null }, db.reader(ADA))).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(await service.drop({ ...body(7), mission: 41 }, ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict', error: expect.stringContaining('with-you') as string });
    const started = db.missions.get(RUNNING);
    if (started === undefined) throw new Error('no mission');
    db.missions.set(RUNNING, { ...started, status: 'delivered' });
    expect(await service.drop(body(7), ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict', error: expect.stringContaining('This one is delivered') as string });
    expect(db.events.some((event) => event.kind === 'drop-asked')).toBe(false);
    expect(db.missions.get(DRAFT)?.status).toBe('draft');
  });
});

describe('POST /api/missions/drop', () => {
  const request = (payload: unknown, authorization: string | null = 'Bearer t') =>
    new Request('https://omni.example/api/missions/drop', { method: 'POST', headers: authorization === null ? {} : { authorization }, body: JSON.stringify(payload) });

  async function served() {
    const { db, service } = await onBranch();
    const lines: string[] = [];
    const deps: MissionsDeps = {
      session: null,
      service,
      bearer: (header) => Promise.resolve(header === null ? null : { caller: ADA, reader: db.reader(ADA) }),
      log: (line) => { lines.push(line); },
    };
    return { db, deps };
  }

  it('answers 200 with what is dropped, never cached, and records the ask', async () => {
    const { db, deps } = await served();
    const res = await dropMission(request({ repo: 'acme/shop', mission: 42, prd: 8 }), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ drop: { mission: RUNNING, branch: 'mission/42-pay-online', prd: 8, sharing: [], dropped: [8], keep: false } });
    expect(db.events.at(-1)?.kind).toBe('drop-asked');
  });

  it('answers 401 with no token, 400 to a body that is none, 409 to a PRD not on the branch, 503 with no database', async () => {
    const { deps } = await served();
    expect((await dropMission(request({ repo: 'acme/shop', mission: 42, prd: 8 }, null), deps)).status).toBe(401);
    expect((await dropMission(request({ repo: 'nope', mission: 42, prd: 8 }), deps)).status).toBe(400);
    expect((await dropMission(request({ repo: 'acme/shop', mission: 42, prd: 5 }), deps)).status).toBe(409);
    expect((await dropMission(request({}), { session: null, service: null, bearer: null, log: () => undefined })).status).toBe(503);
  });
});
