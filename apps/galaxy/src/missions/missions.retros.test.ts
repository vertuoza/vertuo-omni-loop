import { describe, expect, it } from 'vitest';
import { answerMissionItem, moveMission, stopStuckMission, type MissionsDeps } from './missions.controller';
import { ADA, BEN, DAN, DRAFT, fakeMissionsDb, ITEM, PAUSED, STUCK } from './missions.fake';
import { missionsService } from './missions.service';

// A mission paused by stuck is resumed or stopped by a member, and a mission item is adopted or declined once (PRD 3065 s5, AC-8),
// with the real service on the database in memory.

function deps(person: typeof ADA | null) {
  const db = fakeMissionsDb({ stuck: true });
  const given: MissionsDeps = {
    session: () => Promise.resolve(person === null ? null : { caller: person, reader: db.reader(person) }),
    service: missionsService(db.writer, { now: () => new Date('2027-01-26T10:00:00.000Z') }),
    log: () => undefined,
  };
  return { deps: given, db };
}
const post = (body: unknown) => new Request('http://local/x', { method: 'POST', body: JSON.stringify(body) });

describe('Resume of a mission paused by stuck', () => {
  it('moves it to running, records the Resume and the member\'s own answer to the stuck pause', async () => {
    const { deps: given, db } = deps(ADA);
    expect((await moveMission('resume', STUCK, given)).status).toBe(200);
    expect(db.missions.get(STUCK)?.status).toBe('running');
    expect(db.events.filter((e) => e.mission === STUCK).map((e) => [e.kind, e.actor])).toEqual([['resumed', 'ada'], ['stuck-answer', 'ada']]);
  });

  it('records no stuck answer for a mission paused any other way', async () => {
    const { deps: given, db } = deps(ADA);
    expect((await moveMission('resume', PAUSED, given)).status).toBe(200);
    expect(db.events.map((e) => e.kind)).toEqual(['resumed']);
  });
});

describe('stopStuckMission', () => {
  it('ends the mission stopped, saying it was stuck, and records the member\'s answer', async () => {
    const { deps: given, db } = deps(BEN);
    const res = await stopStuckMission(STUCK, given);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mission: { id: STUCK, status: 'stopped' } });
    expect(db.missions.get(STUCK)).toMatchObject({ status: 'stopped', waitingOn: 'Stopped: the mission was stuck.' });
    expect(db.events).toMatchObject([{ kind: 'stuck-answer', actor: 'ben', sentence: 'ben stopped the mission: it was stuck.' }]);
  });

  it('refuses a mission that is not paused by stuck, a stranger, a bad id and nobody signed in', async () => {
    const { deps: given } = deps(ADA);
    expect((await stopStuckMission(PAUSED, given)).status).toBe(409);
    expect((await stopStuckMission(DRAFT, given)).status).toBe(409);
    expect((await stopStuckMission(STUCK, deps(DAN).deps)).status).toBe(403);
    expect((await stopStuckMission('nope', given)).status).toBe(400);
    expect((await stopStuckMission(STUCK, deps(null).deps)).status).toBe(401);
  });
});

describe('answerMissionItem', () => {
  it('adopts once as the member, records their event on the item\'s mission and applies nothing', async () => {
    const { deps: given, db } = deps(ADA);
    const res = await answerMissionItem(ITEM, post({ answer: 'adopted', note: 'Yes, in the next docs pull request.' }), given);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ item: { id: ITEM, answer: 'adopted' } });
    expect(db.items.get(ITEM)).toMatchObject({ answer: 'adopted', note: 'Yes, in the next docs pull request.' });
    expect(db.events).toMatchObject([{ mission: STUCK, kind: 'item-answered', actor: 'ada', sentence: 'Adopted the change to the Roadmap form: Prerequisites.' }]);
  });

  it('keeps the first answer and refuses the second, whoever gives it (AC-8)', async () => {
    const { deps: given, db } = deps(ADA);
    await answerMissionItem(ITEM, post({ answer: 'adopted' }), given);
    const again = await answerMissionItem(ITEM, post({ answer: 'declined' }), given);
    expect(again.status).toBe(409);
    expect(db.items.get(ITEM)?.answer).toBe('adopted');
    expect(db.events.filter((e) => e.kind === 'item-answered')).toHaveLength(1);
  });

  it('refuses an answer that is none, a stranger, a bad id and nobody signed in', async () => {
    const { deps: given } = deps(ADA);
    expect((await answerMissionItem(ITEM, post({ answer: 'maybe' }), given)).status).toBe(400);
    expect((await answerMissionItem(ITEM, post({ answer: 'declined', note: '' }), given)).status).toBe(400);
    expect((await answerMissionItem('nope', post({ answer: 'declined' }), given)).status).toBe(400);
    expect((await answerMissionItem(ITEM, post({ answer: 'declined' }), deps(DAN).deps)).status).toBe(403);
    expect((await answerMissionItem(ITEM, post({ answer: 'declined' }), deps(null).deps)).status).toBe(401);
  });
});
