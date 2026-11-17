import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { pickBugs, type MissionsDeps } from './missions.controller';
import { ADA, BEN, DAN, DRAFT, fakeMissionsDb, RUNNING } from './missions.fake';
import { missionsService } from './missions.service';

// `Decide the bugs` (PRD 3001): a member's pick is recorded as their own event beside QA's verdict, and the mission is woken.

const PRD = parsePrd(3001);
const ROUND_2 = '99999999-9999-4999-8999-999999999999';
const at = '2027-01-22T09:00:00.000Z';

function setup(person: typeof ADA | null = ADA) {
  const db = fakeMissionsDb();
  const deps: MissionsDeps = {
    session: () => Promise.resolve(person === null ? null : { caller: person, reader: db.reader(person) }),
    service: missionsService(db.writer, { now: () => new Date('2027-01-22T10:00:00.000Z') }),
    log: () => undefined,
  };
  return { db, deps };
}
const request = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
const bugsStill = (db: ReturnType<typeof setup>['db']) => {
  db.events.push({ mission: RUNNING, kind: 'checked', actor: 'agent', prd: PRD, job: ROUND_2, at, sentence: '1 bug still there · Round 2 of 2 · #13' });
};

describe('pickBugs (AC-5)', () => {
  it('records Send on to the Reviewer as the person\'s own resumed event naming QA\'s round-2 job, and wakes the mission', async () => {
    const { db, deps } = setup();
    bugsStill(db);
    const res = await pickBugs(RUNNING, request({ prd: PRD, pick: 'review' }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bugs: { mission: RUNNING, prd: PRD, pick: 'review' } });
    expect(db.events.at(-1)).toMatchObject({ kind: 'resumed', actor: 'ada', prd: PRD, job: ROUND_2, sentence: 'ada sent PRD 3001 on to the Reviewer.' });
    expect(db.jobs).toHaveLength(1);
  });

  it('records Stop this PRD as a stopped event', async () => {
    const { db, deps } = setup();
    bugsStill(db);
    expect((await pickBugs(RUNNING, request({ prd: PRD, pick: 'stop' }), deps)).status).toBe(200);
    expect(db.events.at(-1)).toMatchObject({ kind: 'stopped', actor: 'ada', job: ROUND_2, sentence: 'ada stopped PRD 3001.' });
  });

  it('refuses a second pick, naming who made the first', async () => {
    const { db, deps } = setup(BEN);
    bugsStill(db);
    db.events.push({ mission: RUNNING, kind: 'stopped', actor: 'ada', prd: PRD, job: ROUND_2, at, sentence: 'ada stopped PRD 3001.' });
    const res = await pickBugs(RUNNING, request({ prd: PRD, pick: 'review' }), deps);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'ada picked on PRD 3001\'s bugs already.' });
  });

  it('refuses a PRD whose QA passed, or that QA never checked', async () => {
    const { db, deps } = setup();
    db.events.push({ mission: RUNNING, kind: 'checked', actor: 'agent', prd: PRD, job: ROUND_2, at, sentence: 'pass · Round 2 of 2' });
    expect((await pickBugs(RUNNING, request({ prd: PRD, pick: 'review' }), deps)).status).toBe(409);
    expect((await pickBugs(RUNNING, request({ prd: parsePrd(7), pick: 'stop' }), deps)).status).toBe(409);
  });

  it('answers 401 signed out, 403 to a stranger, 409 to a draft, 400 to a pick that is none, and 500 when the wake fails', async () => {
    expect((await pickBugs(RUNNING, request({ prd: PRD, pick: 'stop' }), setup(null).deps)).status).toBe(401);
    expect((await pickBugs(RUNNING, request({ prd: PRD, pick: 'stop' }), setup(DAN).deps)).status).toBe(403);
    expect((await pickBugs(DRAFT, request({ prd: PRD, pick: 'stop' }), setup().deps)).status).toBe(409);
    expect((await pickBugs(RUNNING, request({ prd: PRD, pick: 'maybe' }), setup().deps)).status).toBe(400);
    const broken = fakeMissionsDb({ refusesRefresh: true });
    broken.events.push({ mission: RUNNING, kind: 'checked', actor: 'agent', prd: PRD, job: ROUND_2, at, sentence: '1 bug still there · Round 2 of 2 · #13' });
    const deps: MissionsDeps = { session: () => Promise.resolve({ caller: ADA, reader: broken.reader(ADA) }), service: missionsService(broken.writer, { now: () => new Date(at) }), log: () => undefined };
    expect((await pickBugs(RUNNING, request({ prd: PRD, pick: 'stop' }), deps)).status).toBe(500);
  });
});
