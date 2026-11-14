import { describe, expect, it } from 'vitest';
import { missionOf, progressOf, waitsOf, WORDS, type EventRow, type MissionRow } from './missions-tab';
import { missionsTabService } from './missions-tab.service';
import { missionsTabRepository, type MissionsTabDb } from './missions-tab.repository';

// The Missions tab's rules (PRD 2842 s7): progress, what each PRD waits on, the one move a status allows,
// and the service and repository that read them as the signed-in person.

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WORKSPACE = '33333333-3333-4333-8333-333333333333';

const row = (over: Partial<MissionRow> = {}): MissionRow => ({
  id: ID, repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'running', waitingOn: null, prds: [1, 2, 3, 4], ...over,
});
const event = (kind: string, prd: number | null, link: string | null = null, mission = ID): EventRow => ({ mission, kind, prd, link });

describe('progressOf', () => {
  it('reads a draft as not started', () => {
    expect(progressOf('draft', [1, 2], [])).toBe(WORDS.notStarted);
  });

  it('counts merged and ready PRDs once each, a merged one never as ready', () => {
    const events = [event('prd-ready', 1), event('prd-merged', 1), event('prd-ready', 2), event('prd-ready', 2), event('prd-merged', 3)];
    expect(progressOf('running', [1, 2, 3, 4], events)).toBe('2 of 4 merged · 1 ready');
  });

  it('counts a PRD of a roadmap the events name even when the scope lists none of it', () => {
    expect(progressOf('running', [1], [event('prd-merged', 9)])).toBe('1 of 2 merged · 0 ready');
  });

  it('says so when no PRD is known yet', () => {
    expect(progressOf('running', [], [])).toBe(WORDS.noPrd);
  });
});

describe('waitsOf', () => {
  it('reads each PRD and what it waits on, linked to its event or its issue', () => {
    const waits = waitsOf('PRD 2803: approve it · PRD 2804: merge it', 'acme/shop', [event('prd-ready', 2804, 'https://github.com/acme/shop/pull/9')]);
    expect(waits).toEqual([
      { prd: 2803, on: 'approve it', href: 'https://github.com/acme/shop/issues/2803' },
      { prd: 2804, on: 'merge it', href: 'https://github.com/acme/shop/pull/9' },
    ]);
  });

  it('is none when nothing is waited on', () => {
    expect(waitsOf(null, 'acme/shop', [])).toEqual([]);
    expect(waitsOf('no PRD here', 'acme/shop', [])).toEqual([]);
  });
});

describe('missionOf', () => {
  it('offers Start on a draft, Pause on a running or waiting mission, Resume on a paused one, nothing after', () => {
    const action = (status: MissionRow['status']) => missionOf(row({ status }), []).action;
    expect([action('draft'), action('running'), action('waiting'), action('paused'), action('delivered'), action('stopped')]).toEqual(['start', 'pause', 'pause', 'resume', null, null]);
  });

  it('shows the PRDs a waiting mission waits on, and why a stopped one stopped', () => {
    expect(missionOf(row({ status: 'waiting', waitingOn: 'PRD 5: merge it' }), []).waits).toHaveLength(1);
    const stopped = missionOf(row({ status: 'stopped', waitingOn: 'PRD 5 stopped: red. Take it to ready by hand and the mission carries on.' }), []);
    expect(stopped.waits).toEqual([]);
    expect(stopped.stopped).toContain('carries on');
  });

  it('links the brief to its issue', () => {
    expect(missionOf(row(), []).briefHref).toBe('https://github.com/acme/shop/issues/40');
  });
});

function fakeDb(missions: unknown[], events: unknown[], failing: 'missions' | 'mission_events' | null = null): MissionsTabDb {
  const chain = (data: unknown[], fails: boolean) => {
    const answer = Promise.resolve(fails ? { data: null, error: { message: 'boom' } } : { data, error: null });
    const self: Record<string, unknown> = { then: answer.then.bind(answer) };
    for (const name of ['select', 'eq', 'in', 'not', 'order', 'limit']) self[name] = () => self;
    return self;
  };
  return { from: (table: string) => chain(table === 'missions' ? missions : events, failing === table) } as unknown as MissionsTabDb;
}

const MISSION_ROW = { id: ID, repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'running', waiting_on: 'PRD 2: merge it', scope: { prds: [1, 2], roadmaps: [] } };

describe('the service over the repository', () => {
  it('gives each mission its own events only', async () => {
    const db = fakeDb([MISSION_ROW, { ...MISSION_ROW, id: OTHER, number: 41 }], [
      { mission_id: ID, kind: 'prd-merged', prd: 1, link: null },
      { mission_id: OTHER, kind: 'prd-merged', prd: 7, link: null },
    ]);
    const view = await missionsTabService(missionsTabRepository(db)).view(WORKSPACE, 'night-shift');
    expect(view.fleet).toBe('night-shift');
    expect(view.missions.map((m) => m.progress)).toEqual(['1 of 2 merged · 0 ready', '1 of 3 merged · 0 ready']);
    expect(view.missions[0]?.waits[0]?.prd).toBe(2);
  });

  it('reads no events for a fleet with no mission', async () => {
    const view = await missionsTabService(missionsTabRepository(fakeDb([], [], 'mission_events'))).view(WORKSPACE, 'night-shift');
    expect(view.missions).toEqual([]);
  });

  it('throws when a read fails, and when a row is malformed', async () => {
    await expect(missionsTabService(missionsTabRepository(fakeDb([], [], 'missions'))).view(WORKSPACE, 'f')).rejects.toThrow('could not read the missions');
    await expect(missionsTabService(missionsTabRepository(fakeDb([MISSION_ROW], [], 'mission_events'))).view(WORKSPACE, 'f')).rejects.toThrow('events');
    await expect(missionsTabService(missionsTabRepository(fakeDb([{ id: 'x' }], []))).view(WORKSPACE, 'f')).rejects.toThrow();
  });
});
