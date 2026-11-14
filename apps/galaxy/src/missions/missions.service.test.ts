import { describe, expect, it } from 'vitest';
import { ADA, BEN, DAN, DELIVERED, DRAFT, ELSEWHERE, fakeMissionsDb, PAUSED, RUNNING } from './missions.fake';
import { FAILED, missionsService, NOT_YOURS } from './missions.service';

// Start, Pause, Resume and the wakes (PRD 2842 s5), on the database in memory and a fixed clock.

const NOW = new Date('2027-01-22T10:00:00.000Z');
const setup = (options: { refusesRefresh?: boolean } = {}) => {
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
