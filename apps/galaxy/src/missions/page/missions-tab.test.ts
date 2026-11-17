import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MissionsTab } from './MissionsTab';
import { branchOf, fleetPrdsOf, missionOf, onBranchOf, progressOf, waitsOf, WORDS, type TabEvent, type MissionRow } from './missions-tab';
import { limitWaitRepository } from '../limit-wait.repository';
import { repairRepository } from '../repair.repository';
import { missionsTabService } from './missions-tab.service';
import { missionsTabRepository, type MissionsTabDb } from './missions-tab.repository';

/** The tab's repository with the waits read beside it, as missions-tab.live.ts composes them. */
const withWaits = (db: Parameters<typeof missionsTabRepository>[0]) => ({ ...missionsTabRepository(db), waits: (missions: readonly string[]) => limitWaitRepository(db).facts(missions), repairs: (missions: readonly string[]) => repairRepository(db).facts(missions) });

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// The Missions tab's rules (PRD 2842 s7): progress, what each PRD waits on, the one move a status allows,
// and the service and repository that read them as the signed-in person.

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WORKSPACE = '33333333-3333-4333-8333-333333333333';

const row = (over: Partial<MissionRow> = {}): MissionRow => ({
  id: ID, repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'running', waitingOn: null, prds: [parsePrd(1), parsePrd(2), parsePrd(3), parsePrd(4)], level: 'with-you', inPlan: false, ...over,
});
const event = (kind: string, prd: number | null, link: string | null = null, mission = ID, sentence = ''): TabEvent => ({ mission, kind, prd: prd === null ? null : parsePrd(prd), link, sentence });

describe('a mission in a plan repository (PRD 2896 s14)', () => {
  it('says committee only at alone, offers no own-branch, and says nothing elsewhere', () => {
    const plan = missionOf(row({ level: 'alone', inPlan: true, status: 'draft' }), []);
    expect(plan.committeeOnly).toBe("committee only: a person merges each target's pull request");
    expect(plan.levels).toEqual(['with-you', 'alone']);
    expect(missionOf(row({ level: 'with-you', inPlan: true }), []).committeeOnly).toBeNull();
    const one = missionOf(row({ level: 'alone' }), []);
    expect(one.committeeOnly).toBeNull();
    expect(one.levels).toEqual(['with-you', 'own-branch', 'alone']);
  });
});

describe('progressOf', () => {
  it('reads a draft as not started', () => {
    expect(progressOf('draft', [parsePrd(1), parsePrd(2)], [])).toBe(WORDS.notStarted);
  });

  it('counts merged and ready PRDs once each, a merged one never as ready', () => {
    const events = [event('prd-ready', 1), event('prd-merged', 1), event('prd-ready', 2), event('prd-ready', 2), event('prd-merged', 3)];
    expect(progressOf('running', [parsePrd(1), parsePrd(2), parsePrd(3), parsePrd(4)], events)).toBe('2 of 4 merged · 1 ready');
  });

  it('counts a PRD of a roadmap the events name even when the scope lists none of it', () => {
    expect(progressOf('running', [parsePrd(1)], [event('prd-merged', 9)])).toBe('1 of 2 merged · 0 ready');
  });

  it('says so when no PRD is known yet', () => {
    expect(progressOf('running', [], [])).toBe(WORDS.noPrd);
  });
});

describe('waitsOf', () => {
  it('reads Decide the bugs with each bug linked to its issue (PRD 3001)', () => {
    expect(waitsOf('PRD 3001: decide bugs #13 #14', 'acme/shop', [])[0]?.bugs).toEqual([{ issue: 13, href: 'https://github.com/acme/shop/issues/13' }, { issue: 14, href: 'https://github.com/acme/shop/issues/14' }]);
    expect(waitsOf('PRD 3001: decide bug #13', 'acme/shop', [])[0]?.bugs).toEqual([{ issue: 13, href: 'https://github.com/acme/shop/issues/13' }]);
  });

  it('reads each PRD and what it waits on, linked to its event or its issue', () => {
    const waits = waitsOf('PRD 2803: approve it · PRD 2804: merge it', 'acme/shop', [event('prd-ready', 2804, 'https://github.com/acme/shop/pull/9')]);
    expect(waits).toEqual([
      { prd: parsePrd(2803), on: 'approve it', href: 'https://github.com/acme/shop/issues/2803', bugs: null },
      { prd: parsePrd(2804), on: 'merge it', href: 'https://github.com/acme/shop/pull/9', bugs: null },
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

function fakeDb(missions: unknown[], events: unknown[], failing: 'missions' | 'mission_events' | null = null, products: unknown[] = []): MissionsTabDb {
  const chain = (data: unknown[], fails: boolean) => {
    const answer = Promise.resolve(fails ? { data: null, error: { message: 'boom' } } : { data, error: null });
    const self: Record<string, unknown> = { then: answer.then.bind(answer) };
    for (const name of ['select', 'eq', 'is', 'in', 'not', 'or', 'order', 'limit']) self[name] = () => self;
    return self;
  };
  return { from: (table: string) => chain(table === 'missions' ? missions : table === 'products' ? products : table === 'runner_jobs' || table === 'mission_repairs' ? [] : events.map((one) => ({ job_id: null, at: '2026-11-17T00:00:00Z', ...(one as object) })), failing === table) } as unknown as MissionsTabDb;
}

const MISSION_ROW = { id: ID, repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'running', waiting_on: 'PRD 2: merge it', scope: { prds: [1, 2], roadmaps: [] }, mandate: { parallel: 2 } };

describe('a mission\'s level (PRD 2896)', () => {
  it('reads with-you for a mandate without one, the level it names otherwise, and allows the change on a draft alone', async () => {
    const level = async (mandate: unknown) => (await missionsTabService(withWaits(fakeDb([{ ...MISSION_ROW, mandate }], []))).view(WORKSPACE, 'night-shift')).missions[0]?.level;
    expect(await level({ parallel: 2 })).toBe('with-you');
    expect(await level({ parallel: 2, level: 'alone', hardToRevert: 0.6, ownPrds: 0 })).toBe('alone');
    expect(missionOf(row({ status: 'draft', level: 'own-branch' }), [])).toMatchObject({ level: 'own-branch', levelWords: 'Own branch', canChangeLevel: true });
    expect(missionOf(row({ status: 'running', level: 'alone' }), [])).toMatchObject({ levelWords: 'Works alone', canChangeLevel: false });
  });
});

describe('a mission in a plan repository, read (PRD 2896 s14)', () => {
  it('is in a plan repository when a live product of the workspace names its repository as its plan', async () => {
    const inPlan = async (products: unknown[]) => (await missionsTabService(withWaits(fakeDb([MISSION_ROW], [], null, products))).view(WORKSPACE, 'night-shift')).missions[0]?.committeeOnly;
    expect(await inPlan([])).toBeNull();
    expect(await inPlan([{ plan_repository: null }])).toBeNull();
    expect(await inPlan([{ plan_repository: 'Acme/Shop' }])).toBeNull();
    const alone = { ...MISSION_ROW, mandate: { level: 'alone' } };
    const view = await missionsTabService(withWaits(fakeDb([alone], [], null, [{ plan_repository: 'Acme/Shop' }]))).view(WORKSPACE, 'night-shift');
    expect(view.missions[0]?.committeeOnly).toBe("committee only: a person merges each target's pull request");
  });
});

describe('the mission branch (PRD 2896 s8)', () => {
  const joined = (prd: number) => event('prd-joined', prd, `https://github.com/acme/shop/pull/${String(prd)}`, ID, `PRD ${String(prd)} joined mission/40-pay: #${String(prd)} squash-merged.`);
  // Newest first, as the repository reads them: 1 joined, 2 joined, 1 dropped, 3 joined, 2 landed.
  const events = [event('prd-merged', 2), joined(3), event('prd-dropped', 1), joined(2), joined(1)];

  it('reads the PRDs on the branch in the order they joined, until dropped or on main', () => {
    expect(onBranchOf(events)).toEqual([3]);
    expect(onBranchOf([joined(2), joined(1)])).toEqual([1, 2]);
    expect(onBranchOf([event('prd-ready', 4)])).toEqual([]);
  });

  it('counts a mission above with-you as `on main` and `joined`, and one at with-you as before', () => {
    const prds = [parsePrd(1), parsePrd(2), parsePrd(3)];
    expect(progressOf('running', prds, events, 'own-branch')).toBe('1 of 3 on main · 1 joined');
    expect(progressOf('running', prds, events)).toBe('1 of 3 merged · 0 ready');
    expect(missionOf(row({ level: 'alone', prds }), events).progress).toBe('1 of 3 on main · 1 joined');
  });

  it('says what is on the branch, whether it follows, and links the pull requests from it', () => {
    expect(branchOf(row({ level: 'own-branch' }), events)).toEqual({
      prds: [3], upToDate: true, hold: null, pullHref: 'https://github.com/acme/shop/pulls?q=is%3Apr%20head%3Amission%2F40-pay', words: 'PRD 3 · up to date',
    });
    expect(branchOf(row({}), [])).toMatchObject({ prds: [], pullHref: null, words: 'no PRD on it yet · up to date' });
  });

  it('says the branch is behind, or red, with the supervisor\'s own words, only while the mission runs or waits', () => {
    const cannot = 'mission/40-pay cannot follow main: "x" conflicts with it in a.ts; no branch changed';
    expect(branchOf(row({ status: 'waiting', waitingOn: cannot }), events)).toMatchObject({ upToDate: false, hold: cannot, words: 'PRD 3 · behind the default branch' });
    const red = 'mission/40-pay is red (checks) since PRD 3 joined: no further PRD joins';
    expect(branchOf(row({ status: 'waiting', waitingOn: red }), events)).toMatchObject({ upToDate: true, hold: red });
    expect(branchOf(row({ status: 'stopped', waitingOn: cannot }), events).hold).toBeNull();
  });

  it('shows no Branch line at with-you or on a draft', () => {
    expect(missionOf(row({}), events).branch).toBeNull();
    expect(missionOf(row({ level: 'alone', status: 'draft' }), []).branch).toBeNull();
    expect(missionOf(row({ level: 'alone' }), events).branch).not.toBeNull();
  });
});

describe('the service over the repository', () => {
  it('gives each mission its own events only', async () => {
    const db = fakeDb([MISSION_ROW, { ...MISSION_ROW, id: OTHER, number: 41 }], [
      { mission_id: ID, kind: 'prd-merged', prd: 1, link: null, sentence: 'merged' },
      { mission_id: OTHER, kind: 'prd-merged', prd: 7, link: null, sentence: 'merged' },
    ]);
    const view = await missionsTabService(withWaits(db)).view(WORKSPACE, 'night-shift');
    expect(view.fleet).toBe('night-shift');
    expect(view.missions.map((m) => m.progress)).toEqual(['1 of 2 merged · 0 ready', '1 of 3 merged · 0 ready']);
    expect(view.missions[0]?.waits[0]?.prd).toBe(2);
  });

  it('reads no events for a fleet with no mission', async () => {
    const view = await missionsTabService(withWaits(fakeDb([], [], 'mission_events'))).view(WORKSPACE, 'night-shift');
    expect(view.missions).toEqual([]);
  });

  it('names the PRDs the fleet\'s PM added, in order, and each row its cap left unwritten (PRD 2896 s12)', () => {
    const events = [
      event('not-written', null, null, ID, 'Refunds by card: not written: the cap is 2.'),
      event('prd-added', 51, null, ID, 'PRD 51 added by the fleet.'),
      event('prd-added', 50, null, ID, 'PRD 50 added by the fleet.'),
    ];
    expect(fleetPrdsOf(events)).toEqual({ added: [parsePrd(50), parsePrd(51)], words: 'PRD 50, PRD 51 added by the fleet', notWritten: ['Refunds by card: not written: the cap is 2.'] });
    expect(missionOf(row({ level: 'alone' }), events).fleetPrds?.words).toBe('PRD 50, PRD 51 added by the fleet');
    expect(fleetPrdsOf([event('prd-ready', 1)])).toBeNull();
    expect(fleetPrdsOf([event('not-written', null, null, ID, 'PRD 52: not written: the cap is 1.')])).toEqual({ added: [], words: null, notWritten: ['PRD 52: not written: the cap is 1.'] });
  });

  it('shows the trust line at alone only, counting what the fleet decided and what a person overturned (PRD 2896 s11)', () => {
    const decided = (prd: number, sentence: string) => event('decided', prd, null, ID, sentence);
    const events = [
      event('overturned', 2, null, ID, 'ada overturned fleet decision 2: no.'),
      decided(2, 'The committee approved PRD 2: pm yes, architect yes, reviewer yes.'),
      decided(1, 'The committee answered a-1 of PRD 1 with option A: pm yes, architect yes, reviewer yes.'),
    ];
    expect(missionOf(row({ level: 'alone' }), events).trust).toBe('2 decisions by the fleet · 1 overturned');
    expect(missionOf(row({ level: 'alone', status: 'draft' }), []).trust).toBeNull();
    expect(missionOf(row({ level: 'own-branch' }), events).trust).toBeNull();
    expect(missionOf(row({}), events).trust).toBeNull();
  });

  it('throws when a read fails, and when a row is malformed', async () => {
    await expect(missionsTabService(withWaits(fakeDb([], [], 'missions'))).view(WORKSPACE, 'f')).rejects.toThrow('could not read the missions');
    await expect(missionsTabService(withWaits(fakeDb([MISSION_ROW], [], 'mission_events'))).view(WORKSPACE, 'f')).rejects.toThrow('events');
    await expect(missionsTabService(withWaits(fakeDb([{ id: 'x' }], []))).view(WORKSPACE, 'f')).rejects.toThrow();
  });
});

describe("a mission's waits (PRD 2949 s5)", () => {
  const wait = { mission: ID, prd: parsePrd(2), kind: 'limit' as const, headline: 'Provider limit reached until 09:00 · waiting until 09:00 (guessed)', lead: 'claude-1 ran out · ', job: { href: '/app/runners#job-abc', label: 'job abc' }, tail: ' · tokens spent waiting 0 · next try 09:00', chip: 'Waiting until 09:00' };

  it("says the room's line on the row, and drops the supervisor's shorter words for the same PRD", () => {
    const mission = missionOf(row({ status: 'running', waitingOn: 'PRD 2: waiting for a provider limit until 09:00 UTC (guessed) · PRD 3: merge it' }), [], [wait]);
    expect(mission.waits.map((w) => w.prd)).toEqual([3]);
    expect(mission.limitWaits).toEqual([wait]);
    const out = renderToStaticMarkup(createElement(MissionsTab, { view: { workspace: null, fleet: 'f', missions: [mission] } }));
    expect(out).toContain('PRD 2: Provider limit reached until 09:00 · waiting until 09:00 (guessed).');
    expect(out).toContain('claude-1 ran out · <a href="/app/runners#job-abc">job abc</a> · tokens spent waiting 0 · next try 09:00');
  });
});
