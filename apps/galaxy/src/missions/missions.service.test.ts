import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { ADA, BEN, DAN, DELIVERED, DRAFT, ELSEWHERE, fakeMissionsDb, PAUSED, RUNNING } from './missions.fake';
import { FAILED, missionsService, NOT_YOURS } from './missions.service';

// Start, Pause, Resume and the wakes (PRD 2842 s5), on the database in memory and a fixed clock.

const NOW = new Date('2027-01-22T10:00:00.000Z');
const setup = (options: { refusesRefresh?: boolean; owners?: readonly string[]; fleetLevel?: 'with-you' | 'own-branch' | 'alone' } = {}) => {
  const db = fakeMissionsDb(options);
  return { db, service: missionsService(db.writer, { now: () => NOW }) };
};
const JOB = (id: string) => ({ kind: 'mission', key: `mission:${id}`, subject: 'acme/shop', payload: { mission: id }, lane: `mission:${id}`, delaySeconds: 0 });

describe('Start', () => {
  it('moves a draft to running, signs the event with the member\'s login and refreshes the mission\'s job due at once', async () => {
    const { db, service } = setup();
    const served = await service.move('start', DRAFT, ADA, db.reader(ADA));
    expect(served).toEqual({ ok: true, value: { mission: { id: DRAFT, status: 'running' } } });
    expect(db.missions.get(DRAFT)).toMatchObject({ status: 'running', startedBy: ADA.id, nextWakeAt: NOW.toISOString() });
    expect(db.events).toEqual([{ mission: DRAFT, kind: 'started', actor: 'ada', sentence: 'ada started the mission.', at: NOW.toISOString() }]);
    expect(db.jobs).toEqual([JOB(DRAFT)]);
  });

  it('refuses a mission that is not a draft, and records and refreshes nothing', async () => {
    const { db, service } = setup();
    const served = await service.move('start', RUNNING, ADA, db.reader(ADA));
    expect(served).toMatchObject({ ok: false, kind: 'conflict', error: 'Only a draft mission starts. This one is running.' });
    expect([db.events, db.jobs]).toEqual([[], []]);
  });

  it('puts the mission back to draft when its job cannot be refreshed, rather than leave it running unwatched', async () => {
    const { db, service } = setup({ refusesRefresh: true });
    const served = await service.move('start', DRAFT, ADA, db.reader(ADA));
    expect(served).toMatchObject({ ok: false, kind: 'database', error: FAILED });
    expect(db.missions.get(DRAFT)?.status).toBe('draft');
  });
});

describe('who may move a mission', () => {
  it('refuses a person outside the mission\'s workspace, who cannot even see it', async () => {
    const { db, service } = setup();
    expect(await service.move('start', DRAFT, DAN, db.reader(DAN))).toMatchObject({ ok: false, kind: 'forbidden', error: NOT_YOURS });
    expect(await service.move('pause', ELSEWHERE, ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'forbidden', error: NOT_YOURS });
    expect(db.missions.get(DRAFT)?.status).toBe('draft');
    expect([db.events, db.jobs]).toEqual([[], []]);
  });

  it('refuses a member with no GitHub login: an event is signed with one', async () => {
    const { db, service } = setup();
    const served = await service.move('start', DRAFT, { id: BEN.id, login: null }, db.reader(BEN));
    expect(served).toMatchObject({ ok: false, kind: 'forbidden' });
    expect(db.events).toEqual([]);
  });
});

describe('Pause and Resume', () => {
  it('Pause moves a running mission to paused, records it and sends and refreshes nothing', async () => {
    const { db, service } = setup();
    expect(await service.move('pause', RUNNING, BEN, db.reader(BEN))).toEqual({ ok: true, value: { mission: { id: RUNNING, status: 'paused' } } });
    expect(db.events.map((e) => [e.kind, e.actor])).toEqual([['paused', 'ben']]);
    expect(db.jobs).toEqual([]);
  });

  it('Resume moves a paused mission to running and refreshes its job at once', async () => {
    const { db, service } = setup();
    expect(await service.move('resume', PAUSED, BEN, db.reader(BEN))).toEqual({ ok: true, value: { mission: { id: PAUSED, status: 'running' } } });
    expect(db.events.map((e) => [e.kind, e.actor])).toEqual([['resumed', 'ben']]);
    expect(db.jobs).toEqual([JOB(PAUSED)]);
  });

  it('refuses to resume a running mission, to pause a paused one and to start a delivered one', async () => {
    const { db, service } = setup();
    expect(await service.move('resume', RUNNING, ADA, db.reader(ADA))).toMatchObject({ kind: 'conflict', error: 'Only a paused mission resumes. This one is running.' });
    expect(await service.move('pause', PAUSED, ADA, db.reader(ADA))).toMatchObject({ kind: 'conflict' });
    expect(await service.move('start', DELIVERED, ADA, db.reader(ADA))).toMatchObject({ kind: 'conflict' });
  });

  it('never overwrites a move that landed between the read and the write', async () => {
    const { db, service } = setup();
    const reader = db.reader(ADA);
    const stale = {
      ...reader,
      mission: async (id: string) => {
        const seen = await reader.mission(id);
        const row = db.missions.get(id);
        if (row) db.missions.set(id, { ...row, status: 'paused' });
        return seen;
      },
    };
    expect(await service.move('pause', RUNNING, ADA, stale)).toMatchObject({ ok: false, kind: 'conflict', error: 'Only a running or waiting mission pauses. It has just moved: look again.' });
    expect(db.events).toEqual([]);
  });
});

describe('Change for this mission (PRD 2896)', () => {
  it('lets a member set a mission to the level its fleet is at, and any member lower it', async () => {
    const { db, service } = setup({ fleetLevel: 'own-branch' });
    expect(await service.setLevel(DRAFT, 'own-branch', ADA, db.reader(ADA))).toEqual({ ok: true, value: { mission: { id: DRAFT, level: 'own-branch' } } });
    expect(db.missions.get(DRAFT)?.level).toBe('own-branch');
    expect(await service.setLevel(DRAFT, 'with-you', BEN, db.reader(BEN))).toEqual({ ok: true, value: { mission: { id: DRAFT, level: 'with-you' } } });
  });

  it('refuses a member who is not an owner a level above the fleet\'s, and lets an owner take it', async () => {
    const { db, service } = setup({ owners: [BEN.id] });
    expect(await service.setLevel(DRAFT, 'alone', ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'forbidden', error: 'Only an owner of the workspace takes a mission above its fleet\'s level.' });
    expect(db.missions.get(DRAFT)?.level).toBe('with-you');
    expect(await service.setLevel(DRAFT, 'alone', BEN, db.reader(BEN))).toMatchObject({ ok: true });
    expect(db.missions.get(DRAFT)?.level).toBe('alone');
  });

  it('refuses to lower a mission to with-you while PRDs sit on its branch, saying how many to land or drop', async () => {
    const { db, service } = setup({ owners: [BEN.id] });
    await service.setLevel(RUNNING, 'own-branch', BEN, db.reader(BEN));
    const at = NOW.toISOString();
    db.events.push(
      { mission: RUNNING, kind: 'prd-joined', actor: 'agent', sentence: 'PRD 7 joined.', at, prd: parsePrd(7) },
      { mission: RUNNING, kind: 'prd-joined', actor: 'agent', sentence: 'PRD 8 joined.', at, prd: parsePrd(8) },
      { mission: RUNNING, kind: 'prd-joined', actor: 'agent', sentence: 'PRD 9 joined.', at, prd: parsePrd(9) },
      { mission: RUNNING, kind: 'prd-dropped', actor: 'ada', sentence: 'PRD 9 dropped.', at, prd: parsePrd(9) },
    );
    expect(await service.setLevel(RUNNING, 'with-you', ADA, db.reader(ADA))).toEqual({ ok: false, kind: 'conflict', error: 'Land or drop the 2 PRDs on mission/42-pay-online first.' });
    expect(db.missions.get(RUNNING)?.level).toBe('own-branch');
    db.events.push({ mission: RUNNING, kind: 'prd-dropped', actor: 'ada', sentence: 'PRD 8 dropped.', at, prd: parsePrd(8) });
    expect(await service.setLevel(RUNNING, 'with-you', ADA, db.reader(ADA))).toMatchObject({ ok: false, error: 'Land or drop the 1 PRD on mission/42-pay-online first.' });
  });

  it('keeps a delivered mission\'s level, and shows a mission to a member of its workspace alone', async () => {
    const { db, service } = setup();
    expect(await service.setLevel(DELIVERED, 'with-you', ADA, db.reader(ADA))).toMatchObject({ ok: false, kind: 'conflict' });
    expect(await service.setLevel(DRAFT, 'with-you', DAN, db.reader(DAN))).toMatchObject({ ok: false, kind: 'forbidden', error: NOT_YOURS });
  });
});

describe('the wakes', () => {
  it('a job\'s end refreshes the job of a running or paused mission, and of no other', async () => {
    const { db, service } = setup();
    expect(await service.wake(RUNNING)).toBe(true);
    expect(await service.wake(PAUSED)).toBe(true);
    expect(await service.wake(DRAFT)).toBe(false);
    expect(await service.wake(DELIVERED)).toBe(false);
    expect(await service.wake('ffffffff-ffff-4fff-8fff-ffffffffffff')).toBe(false);
    expect(db.jobs).toEqual([JOB(RUNNING), JOB(PAUSED)]);
  });

  it('a stage change or an answer wakes the repository\'s missions that run, wait or are paused, and no other repository\'s', async () => {
    const { db, service } = setup();
    expect(await service.wakeRepo('acme/shop')).toBe(2);
    expect(db.jobs).toEqual([JOB(RUNNING), JOB(PAUSED)]);
    expect(await service.wakeRepo('nobody/nothing')).toBe(0);
  });
});
