import { describe, expect, it } from 'vitest';
import { levelMission, moveMission, type MissionsDeps } from './missions.controller';
import { ADA, DAN, DRAFT, fakeMissionsDb, RUNNING } from './missions.fake';
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
