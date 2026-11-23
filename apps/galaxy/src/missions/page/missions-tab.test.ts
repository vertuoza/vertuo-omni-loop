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

/** What the token caps read (PRD 3040): the person's role, the fleet's cap and spending, each mission's spending, the stops that wait. */
type Caps = { owner?: boolean; daily?: number | null; fleet?: number; spent?: Record<string, number>; stops?: unknown[]; retros?: unknown[]; items?: unknown[]; players?: unknown[]; level?: string; requests?: unknown[] };

function fakeDb(missions: unknown[], events: unknown[], failing: 'missions' | 'mission_events' | null = null, products: unknown[] = [], caps: Caps = {}): MissionsTabDb {
  const chain = (data: unknown[], fails: boolean) => {
    const answer = Promise.resolve(fails ? { data: null, error: { message: 'boom' } } : { data, error: null });
    const self: Record<string, unknown> = { then: answer.then.bind(answer), maybeSingle: () => Promise.resolve({ data: data[0] ?? null, error: null }) };
    for (const name of ['select', 'eq', 'is', 'in', 'not', 'or', 'order', 'limit']) self[name] = () => self;
    return self;
  };
  const tables: Record<string, unknown[]> = {
    missions, products, runner_jobs: [], mission_repairs: [], teams: [{ daily_tokens: caps.daily ?? null, ...(caps.level === undefined ? {} : { level: caps.level }) }], mission_requests: caps.requests ?? [], mission_budget_stops: caps.stops ?? [], mission_retros: caps.retros ?? [], mission_items: caps.items ?? [], players: caps.players ?? [],
  };
  const rpc = (name: string, args: { p_mission?: string }) => Promise.resolve({
    data: name === 'is_owner' ? caps.owner === true : name === 'fleet_tokens_24h' ? [{ tokens: caps.fleet ?? 0, oldest_end: null }] : (caps.spent?.[args.p_mission ?? ''] ?? 0),
    error: null,
  });
  return { rpc, from: (table: string) => chain(tables[table] ?? events.map((one) => ({ job_id: null, at: '2026-11-17T00:00:00Z', ...(one as object) })), failing === table) } as unknown as MissionsTabDb;
}

const MISSION_ROW = { id: ID, repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'running', waiting_on: 'PRD 2: merge it', scope: { prds: [1, 2], roadmaps: [] }, mandate: { parallel: 2 } };

// PRD 3065 s5: what the tab reads of a mission's stuck state, its retros and its own outbox.
describe('the retros and the questions, read (PRD 3065)', () => {
  const USER = '44444444-4444-4444-8444-444444444444';
  const RETRO = { id: '55555555-5555-4555-8555-555555555555', mission_id: ID, milestone: '2790', file: 'm/retros/1-roadmap-2790.md', skipped: null, created_at: '2027-01-26T09:00:00Z', retro: { wentWell: [{ text: 'It went.', cites: [{ kind: 'prd', ref: 2803 }] }], toChange: [{ text: 'Change it.', cites: [{ kind: 'repair', ref: 4 }] }] } };
  const ITEM = { id: '66666666-6666-4666-8666-666666666666', mission_id: ID, target: 'law BR-PRODUCT-12', wording: 'Reword it.', evidence: ['One sentence.'], answer: 'adopted', note: null, answered_by: USER, created_at: '2027-01-26T09:01:00Z' };

  it('gives each mission its retros and its questions, an answered one with the name of who answered', async () => {
    const db = fakeDb([MISSION_ROW, { ...MISSION_ROW, id: OTHER, number: 41 }], [], null, [], { retros: [RETRO], items: [ITEM], players: [{ user_id: USER, display_name: 'Irisa' }] });
    const view = await missionsTabService(withWaits(db)).view(WORKSPACE, 'night-shift');
    expect(view.missions[0]?.retros.map((card) => [card.headline, card.wentWell[0]?.text, card.file?.path])).toEqual([['Roadmap #2790 delivered', 'It went.', 'retros/1-roadmap-2790.md']]);
    expect(view.missions[0]?.questions[0]).toMatchObject({ title: 'Change law BR-PRODUCT-12', answered: { by: 'Irisa', words: 'Adopted', apply: '/omni:knowledge-add amend BR-PRODUCT-12 (only its owner approves).' } });
    expect(view.missions[1]).toMatchObject({ retros: [], questions: [] });
  });

  it('reads a retro it cannot read whole as not written, and a name it cannot read as a member', async () => {
    const db = fakeDb([MISSION_ROW], [], null, [], { retros: [{ ...RETRO, retro: { wentWell: 'x' } }], items: [ITEM] });
    const view = await missionsTabService(withWaits(db)).view(WORKSPACE, 'night-shift');
    expect(view.missions[0]?.retros[0]).toMatchObject({ wentWell: [], toChange: [], keptHere: null, skipped: 'Retro skipped: it could not be read' });
    expect(view.missions[0]?.questions[0]?.answered?.by).toBe('a member');
  });

  it('reads a mission paused by stuck from its row, and no other pause', async () => {
    const paused = { ...MISSION_ROW, status: 'paused', paused_by: 'stuck' };
    const view = await missionsTabService(withWaits(fakeDb([paused, { ...paused, id: OTHER, paused_by: null }], []))).view(WORKSPACE, 'night-shift');
    expect(view.missions.map((m) => [m.statusWords, m.action, m.stuckPaused !== null])).toEqual([['Paused: stuck', null, true], ['Paused', 'resume', false]]);
  });
});

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

// The token caps (PRD 3040 s4, AC-10): the fleet's cap line, each mission's budget line and the stop that paused it.
describe('the token caps on the Missions tab (PRD 3040)', () => {
  const STOP = '44444444-4444-4444-8444-444444444444';
  const view = (mission: unknown, caps: Caps) => missionsTabService(withWaits(fakeDb([mission], [], null, [], caps))).view(WORKSPACE, 'night-shift');

  it('AC-10: says 412k of 2M tokens for a mission with a budget, and No token budget for one without', async () => {
    const budgeted = await view({ ...MISSION_ROW, mandate: { parallel: 2, tokens: 2_000_000 } }, { spent: { [ID]: 412_000 } });
    expect(budgeted.missions[0]?.budget).toEqual({ words: '412k of 2M tokens', tokens: 2_000_000, canChange: false });
    const none = await view(MISSION_ROW, { spent: { [ID]: 412_000 } });
    expect(none.missions[0]?.budget.words).toBe('No token budget');
  });

  it('lets a draft\'s budget be changed for that mission alone', async () => {
    expect((await view({ ...MISSION_ROW, status: 'draft' }, {})).missions[0]?.budget.canChange).toBe(true);
    expect((await view(MISSION_ROW, {})).missions[0]?.budget.canChange).toBe(false);
  });

  it('reads No daily cap, or 1.3M of 2M with Change for an owner only', async () => {
    expect((await view(MISSION_ROW, {})).daily).toMatchObject({ words: 'No daily cap', canChange: false, notice: null });
    const capped = (await view(MISSION_ROW, { daily: 2_000_000, fleet: 1_300_000, owner: true })).daily;
    expect(capped).toMatchObject({ words: '1.3M of 2M', window: 'in the last 24 hours', cap: 2_000_000, canChange: true });
    expect((await view(MISSION_ROW, { daily: 2_000_000, owner: false })).daily?.canChange).toBe(false);
  });

  it('shows Paused: budget reached with whose cap and what was spent on a mission its own cap paused, with its two actions', async () => {
    const stop = { id: STOP, cap: 'mission', cap_tokens: 2_000_000, spent: 2_000_000, missions: [ID] };
    const paused = (await view({ ...MISSION_ROW, status: 'paused' }, { stops: [stop], owner: true })).missions[0]?.stop;
    expect(paused).toEqual({ id: STOP, headline: 'Paused: budget reached', detail: '2.0M of 2M tokens · this mission\'s budget', actions: ['raised', 'stopped'], canRaise: true });
    expect((await view({ ...MISSION_ROW, status: 'paused' }, { stops: [stop], owner: false })).missions[0]?.stop?.canRaise).toBe(false);
    expect((await view(MISSION_ROW, { stops: [stop] })).missions[0]?.stop).toBeNull();
  });

  it('asks a fleet\'s cap once, above the list, and gives each mission it paused no action of its own', async () => {
    const stop = { id: STOP, cap: 'fleet', cap_tokens: 2_000_000, spent: 2_100_000, missions: [ID, OTHER] };
    const out = await view({ ...MISSION_ROW, status: 'paused' }, { stops: [stop], owner: true, daily: 2_000_000, fleet: 2_100_000 });
    expect(out.daily?.notice).toEqual({ id: STOP, headline: 'Paused: this fleet\'s daily cap reached (2M)', detail: '2.1M of 2M tokens in the last 24 hours · this fleet\'s daily cap', missions: 2, canRaise: true });
    expect(out.missions[0]?.stop?.actions).toEqual([]);
  });

  it('throws when a cap cannot be read', async () => {
    const db = fakeDb([MISSION_ROW], []);
    const broken = { ...db, rpc: () => Promise.resolve({ data: null, error: { message: 'boom' } }) } as unknown as MissionsTabDb;
    await expect(missionsTabService(withWaits(broken)).view(WORKSPACE, 'f')).rejects.toThrow('could not read your role');
  });
});

// The New mission box and the goal-only rows (PRD omni-loop-24 s6, `mission-start` 1.A to 1.D), read as the signed-in person.
describe('the New mission box and a goal from nothing (PRD omni-loop-24)', () => {
  const REQUEST = '77777777-7777-4777-8777-777777777777';
  const view = (caps: Caps, missions: unknown[] = []) => missionsTabService(withWaits(fakeDb(missions, [], null, [], caps))).view(WORKSPACE, 'night-shift');
  const goalOnly = { ...MISSION_ROW, scope: { prds: [], roadmaps: [] }, mandate: { level: 'alone', ownPrds: 10 } };

  it('opens the box to an owner, and to any member on a fleet at Works alone, and to nobody else (1.C)', async () => {
    expect((await view({ owner: true, level: 'with-you' })).box).toEqual({ canStart: true, refusal: null });
    expect((await view({ owner: false, level: 'alone' })).box).toEqual({ canStart: true, refusal: null });
    expect((await view({ owner: false, level: 'with-you' })).box).toEqual({ canStart: false, refusal: 'Works alone only. Ask an owner.' });
    expect((await view({ owner: false })).box?.canStart).toBe(false);
  });

  it('lists a request whose mission is not pushed yet as Writing the mission, goal as typed', async () => {
    const out = await view({ requests: [{ id: REQUEST, goal: '  Quotes on the phone ' }] });
    expect(out.requests).toEqual([{ id: REQUEST, goal: '  Quotes on the phone ', words: 'Writing the mission' }]);
    expect((await view({})).requests).toEqual([]);
  });

  it('reads Writing the roadmap while a goal-only mission has no PRD, and No PRD sent yet for a scoped one', async () => {
    const out = await view({}, [goalOnly, { ...MISSION_ROW, id: OTHER, number: 41, scope: { prds: [], roadmaps: [7] }, mandate: { level: 'alone' } }]);
    expect(out.missions.map((m) => m.progress)).toEqual(['Writing the roadmap', 'No PRD sent yet']);
  });

  it('reads No PRD written with the PM\'s reason once the mission waits on it, never a plain waiting row', async () => {
    const why = 'the PM wrote no PRD for the goal: /omni:roadmap ended with no PRD in its record, sent twice.';
    const waiting = (await view({}, [{ ...goalOnly, status: 'waiting', waiting_on: why }])).missions[0];
    expect(waiting).toMatchObject({ progress: 'No PRD written', noPrd: { why }, statusWords: 'Waiting on you', waits: [], action: 'pause' });
    expect((await view({}, [{ ...MISSION_ROW, status: 'waiting', waiting_on: why }])).missions[0]?.noPrd).toBeNull();
    expect(missionOf(row({ goalOnly: true, level: 'alone', status: 'running', prds: [] }), []).noPrd).toBeNull();
  });

  it('#3203: offers Resume, never Pause, on the row of a goal-only mission waiting on no PRD (1.D)', async () => {
    const why = 'the PM wrote no PRD for the goal: /omni:roadmap ended with no PRD in its record, sent twice.';
    expect((await view({}, [{ ...goalOnly, status: 'waiting', waiting_on: why }])).missions[0]?.action).toBe('resume');
    expect((await view({}, [{ ...goalOnly, status: 'waiting', waiting_on: 'PRD 50: approval' }])).missions[0]?.action).toBe('pause');
  });

  it('throws when the level or the requests cannot be read', async () => {
    const failing = (table: string): MissionsTabDb => {
      const db = fakeDb([], []);
      return { ...db, from: (name: string) => (name === table ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: 'boom' } }), is: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }) }) }) }) }) } : db.from(name)) } as unknown as MissionsTabDb;
    };
    await expect(missionsTabService(withWaits(failing('mission_requests'))).view(WORKSPACE, 'f')).rejects.toThrow('mission requests');
    await expect(missionsTabRepository(failing('teams')).fleetLevel(WORKSPACE, 'f')).rejects.toThrow('fleet\'s level');
  });
});
