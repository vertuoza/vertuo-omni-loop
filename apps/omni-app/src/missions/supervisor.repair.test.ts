// The supervisor's repair decisions (PRD 2980 s5), pure: where a failed PRD goes given what a run read of its mission's repairs.
import { describe, expect, it } from 'vitest';
import { parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RepairRetro } from 'omni-loop/kit/lib/repair/retro.ts';
import type { PullRead } from './gate.ts';
import {
  judgeFix,
  MISSION_REPAIRS,
  NO_REPAIRS,
  repairKey,
  repairLine,
  failedJobOf,
  repairOfKey,
  roundOf,
  unreadableFingerprint,
  type RepairJob,
  type RepairRow,
  type RepairView,
} from './repair.ts';
import { conclude, eventsOf, pick, prdStates, recordedKeys, type Attempt, type Mission, type PrdFacts, type Run } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const p = (n: number): PrdNumber => parsePrd(n);
const FP = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

const mission = (over: Partial<Mission> = {}): Mission => ({ id: ID, fleet: 'night-shift', status: 'running', parallel: 2, waitingOn: null, level: 'own-branch', number: 12, title: 'Faster quotes', ...over });
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });
const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'running', outcome: null, reason: null, prUrl: null, ...over });
const failed = (id: string) => attempt(id, { status: 'failed', reason: 'test failed: quote total' });
const run = (n: number, k: number, ...attempts: Attempt[]): Run => ({ prd: p(n), run: k, step: 'build', job: attempts[0]?.id ?? `job-${String(n)}-${String(k)}`, attempts });

const retro = (over: Partial<RepairRetro> = {}): RepairRetro => ({
  cause: 'The quote total test expects a rounded sum.',
  class: 'code',
  place: 'apps/quotes/total.ts',
  signature: 'AssertionError: expected 10.01 to be 10',
  evidence: ['The test failed on the rounded total.'],
  proposedFix: 'Round the total before it is compared.',
  fingerprint: FP,
  ...over,
});
const repairJob = (prd: number, k: number, failedJob: string, ...attempts: Attempt[]): RepairJob => ({ prd: p(prd), k, job: attempts[0]?.id ?? `r-${String(k)}`, failedJob, attempts });
const row = (over: Partial<RepairRow> = {}): RepairRow => ({ id: `row-${over.job ?? 'r'}`, prd: p(1), fingerprint: FP, round: 1, number: 1, failedJob: 'a', job: 'r1', retro: retro(), fixPr: 'https://github.com/acme/widgets/pull/12', outcome: null, ...over });
const view = (over: Partial<RepairView> = {}): RepairView => ({ ...NO_REPAIRS, budget: MISSION_REPAIRS, ...over });

const stateOf = (runs: Run[], repairs: RepairView, all = [facts(1)]) => prdStates(all, runs, undefined, undefined, undefined, repairs).get(p(1));

describe('the repair job: its key and its line', () => {
  it('is keyed mission:<id>:prd:<n>:repair:<k>, and read back', () => {
    expect(repairKey(ID, p(7), 2)).toBe(`mission:${ID}:prd:7:repair:2`);
    expect(repairOfKey(`mission:${ID}:prd:7:repair:2`)).toEqual({ prd: 7, k: 2 });
    expect(repairOfKey(`mission:${ID}:prd:7:run:2`)).toBeNull();
  });

  it('is sent as /omni:repair, naming the mission by its number, the PRD and the failed job', () => {
    expect(repairLine(12, p(7), 'job-9')).toBe('/omni:repair --mission 12 --prd 7 --job job-9');
    expect(failedJobOf('/omni:repair --mission 12 --prd 7 --job job-9')).toBe('job-9');
    expect(failedJobOf('/omni:yolo 7')).toBeNull();
  });
});

describe('a failure sends a repair, not a stop (AC-1)', () => {
  it('sends a repair for a failed job, a second hold and a second stop mid-way', () => {
    expect(stateOf([run(1, 1, failed('a'))], view())).toEqual({ state: 'repairable', k: 1, failedJob: 'a' });
    const held = [run(1, 1, attempt('a', { status: 'done', outcome: 'held' })), run(1, 2, attempt('b', { status: 'done', outcome: 'held' }))];
    expect(stateOf(held, view())).toEqual({ state: 'repairable', k: 1, failedJob: 'b' });
    const stopped = [run(1, 1, attempt('a', { status: 'done', outcome: null })), run(1, 2, attempt('b', { status: 'done', outcome: null }))];
    expect(stateOf(stopped, view())).toEqual({ state: 'repairable', k: 1, failedJob: 'b' });
  });

  it('sends nothing on a cancel, and stops as before with repairs off', () => {
    expect(stateOf([run(1, 1, attempt('a', { status: 'cancelled' }))], view())).toEqual({ state: 'paused' });
    expect(stateOf([run(1, 1, failed('a'))], NO_REPAIRS)).toEqual({ state: 'stopped', why: 'its job failed: test failed: quote total' });
  });

  it('reads Repairing (1 of 3) while the repair runs, its slot held', () => {
    const repairs = view({ jobs: [repairJob(1, 1, 'a', attempt('r1'))] });
    expect(stateOf([run(1, 1, failed('a'))], repairs)).toEqual({ state: 'repairing', number: 1, left: 8, why: null });
    const all = [facts(1), facts(2)];
    const states = prdStates(all, [run(1, 1, failed('a'))], undefined, undefined, undefined, repairs);
    expect(pick({ mission: mission({ parallel: 1 }), facts: all, states })).toEqual([]);
    expect(conclude({ mission: mission(), facts: all, states, sent: 0, now: NOW })).toMatchObject({ status: 'running', waitingOn: 'PRD 1: repairing (1 of 3) · 8 left in this mission' });
  });

  it('a lost repair spends nothing: its resume carries it (AC-7)', () => {
    const lost = view({ jobs: [repairJob(1, 1, 'a', attempt('r1', { status: 'failed', reason: 'runner lost' }), attempt('r1b', { status: 'queued' }))] });
    expect(stateOf([run(1, 1, failed('a'))], lost)).toMatchObject({ state: 'repairing', left: 8 });
  });
});

describe('a repair\'s record, by its class', () => {
  const ended = repairJob(1, 1, 'a', attempt('r1', { status: 'done' }));
  const failedRun = [run(1, 1, failed('a'))];

  it('code: waits for its fix to land, then sends the step again', () => {
    expect(stateOf(failedRun, view({ jobs: [ended], rows: [row()] }))).toEqual({ state: 'repairing', number: 1, left: 8, why: 'its fix #12 lands once green' });
    expect(stateOf(failedRun, view({ jobs: [ended], rows: [row()], landings: new Map([['r1', { state: 'waits', lacks: ['test not finished'] }]]) }))).toMatchObject({ why: 'its fix #12 waits: test not finished' });
    expect(stateOf(failedRun, view({ jobs: [ended], rows: [row()], landings: new Map([['r1', { state: 'landed' }]]) }))).toEqual({ state: 'startable', run: 2, step: 'build' });
  });

  it('code: a fix that cannot land stops the PRD, saying why', () => {
    const refused = view({ jobs: [ended], rows: [row()], landings: new Map([['r1', { state: 'refused', why: 'GitHub refused the merge: Merge conflict' }]]) });
    expect(stateOf(failedRun, refused)).toEqual({ state: 'stopped', why: 'its fix #12 cannot land on the mission branch: GitHub refused the merge: Merge conflict' });
    expect(stateOf(failedRun, view({ jobs: [ended], rows: [row({ fixPr: null, outcome: 'stopped' })] }))).toMatchObject({ state: 'stopped', why: expect.stringContaining('opened no fix') as unknown });
  });

  it('flake: sends the step again with no fix; person: stops with the question (AC-9)', () => {
    expect(stateOf(failedRun, view({ jobs: [ended], rows: [row({ retro: retro({ class: 'flake' }), fixPr: null })] }))).toEqual({ state: 'startable', run: 2, step: 'build' });
    const person = view({ jobs: [ended], rows: [row({ retro: retro({ class: 'person', cause: 'The deploy key is missing.', proposedFix: 'Add the deploy key.' }), fixPr: null, outcome: 'stopped' })] });
    expect(stateOf(failedRun, person)).toEqual({ state: 'stopped', why: `its repair [${FP.slice(0, 8)}] needs a person: The deploy key is missing. Add the deploy key.` });
  });

  it('omni-loop: stops, waiting on the Omni Loop bug once filed, or saying why no report was sent (AC-5, AC-6)', () => {
    const base = { jobs: [ended], rows: [row({ retro: retro({ class: 'omni-loop' }), fixPr: null, outcome: 'stopped' })] };
    expect(stateOf(failedRun, view(base))).toEqual({ state: 'stopped', why: `its Omni Loop bug report [${FP.slice(0, 8)}] is being filed` });
    expect(stateOf(failedRun, view({ ...base, reports: new Map([['r1', { state: 'filed', repo: 'vertuoza/vertuo-omni-loop', issue: 3100 }]]) }))).toEqual({ state: 'stopped', why: 'Waits on Omni Loop bug #3100' });
    expect(stateOf(failedRun, view({ ...base, reports: new Map([['r1', { state: 'refused', why: 'the message still holds a token after scrubbing' }]]) }))).toMatchObject({ why: expect.stringContaining('was not sent: the message still holds a token') as unknown });
  });

  it('an unreadable record spends one and the failure is repaired again (AC-7)', () => {
    const unreadable = view({ jobs: [ended], rows: [row({ fingerprint: unreadableFingerprint(p(1)), retro: null, fixPr: null, outcome: 'not fixed' })] });
    expect(stateOf(failedRun, unreadable)).toEqual({ state: 'repairable', k: 2, failedJob: 'a' });
  });
});

describe('the budget: 3 per cause in a round, 9 per mission (AC-3, AC-4, AC-8)', () => {
  const tried = (n: number, over: Partial<RepairRow> = {}): RepairRow => row({ id: `row-${String(n)}`, job: `r${String(n)}`, number: n, failedJob: `f${String(n)}`, fixPr: `https://github.com/acme/widgets/pull/${String(10 + n)}`, outcome: 'not fixed', ...over });

  it('stops a cause repaired 3 times in the round with the cause, the fixes tried, the proposed fix and how to resume', () => {
    const fourth = repairJob(1, 4, 'f4', attempt('r4', { status: 'done' }));
    const repairs = view({ jobs: [fourth], rows: [tried(1), tried(2), tried(3)], refused: new Map([['r4', { spent: 'cause', fingerprint: FP, retro: retro() }]]) });
    const state = stateOf([run(1, 4, failed('f4'))], repairs);
    expect(state).toEqual({
      state: 'stopped',
      why: `its cause [${FP.slice(0, 8)}] was repaired 3 times: The quote total test expects a rounded sum. Tried: #11 not fixed, #12 not fixed, #13 not fixed. Proposed fix: Round the total before it is compared. Resume gives each cause 3 more (6 of 9 left in this mission).`,
    });
  });

  it('sends no 10th repair: the PRD stops saying the mission spent its 9', () => {
    const nine = Array.from({ length: 9 }, (_, n) => tried(n + 1, { prd: p(2), fingerprint: n % 2 === 0 ? FP : OTHER, round: n < 3 ? 1 : 2, number: 1 }));
    expect(stateOf([run(1, 1, failed('a'))], view({ rows: nine }))).toEqual({ state: 'stopped', why: 'its job failed: test failed: quote total, and the mission spent its 9 repairs' });
  });

  it('counts a repair at work against the 9, never a lost one', () => {
    const eight = Array.from({ length: 8 }, (_, n) => tried(n + 1, { prd: p(2), round: 1 + n, outcome: n === 0 ? 'lost' : 'not fixed' }));
    expect(stateOf([run(1, 1, failed('a'))], view({ rows: eight }))).toMatchObject({ state: 'repairable' });
    const atWork = view({ rows: eight, jobs: [repairJob(3, 1, 'z', attempt('rz'))] });
    expect(stateOf([run(1, 1, failed('a'))], atWork)).toMatchObject({ state: 'repairable' });
    const twoAtWork = view({ rows: eight, jobs: [repairJob(3, 1, 'z', attempt('rz')), repairJob(4, 1, 'y', attempt('ry'))] });
    expect(stateOf([run(1, 1, failed('a'))], twoAtWork)).toMatchObject({ state: 'stopped' });
  });

  it('a Resume after the mission stopped opens a new round; a Resume after a pause opens none', () => {
    const e = (kind: string, prd: number | null = null) => ({ kind, prd: prd === null ? null : p(prd), job: null });
    expect(roundOf([])).toBe(1);
    expect(roundOf([e('started'), e('paused'), e('resumed')])).toBe(1);
    expect(roundOf([e('started'), e('stopped', 1), e('stopped'), e('resumed'), e('stopped'), e('resumed')])).toBe(3);
  });

  it('in a new round, a PRD its repair stopped is sent its step again', () => {
    const person = view({ round: 2, jobs: [repairJob(1, 1, 'a', attempt('r1', { status: 'done' }))], rows: [row({ retro: retro({ class: 'person' }), fixPr: null, outcome: 'stopped' })] });
    expect(stateOf([run(1, 1, failed('a'))], person)).toEqual({ state: 'startable', run: 2, step: 'build' });
  });
});

describe('a fix\'s landing on the mission branch', () => {
  const BRANCH = 'mission/12-faster-quotes';
  const pull = (over: Partial<PullRead> = {}): PullRead => ({
    number: 12,
    url: 'https://github.com/acme/widgets/pull/12',
    title: 'fix: round the quote total',
    state: 'open',
    draft: false,
    merged: false,
    base: BRANCH,
    defaultBranch: 'main',
    head: 'abc',
    runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
    statuses: [],
    reviews: [],
    items: { ranks: [] },
    ...over,
  });

  it('merges a green fix into the mission branch, never one into the default branch', () => {
    expect(judgeFix(pull(), BRANCH)).toEqual({ state: 'merge' });
    expect(judgeFix(pull({ merged: true }), BRANCH)).toEqual({ state: 'landed' });
    expect(judgeFix(pull({ base: 'main' }), BRANCH)).toEqual({ state: 'refused', why: '#12 targets main, not mission/12-faster-quotes' });
    expect(judgeFix(pull({ base: BRANCH, defaultBranch: BRANCH }), BRANCH)).toMatchObject({ state: 'refused' });
    expect(judgeFix(pull({ merged: true, base: 'main' }), BRANCH)).toMatchObject({ state: 'refused' });
  });

  it('waits on a draft or checks still running; refuses a red or closed fix', () => {
    expect(judgeFix(pull({ draft: true }), BRANCH)).toEqual({ state: 'waits', lacks: ['#12 is a draft'] });
    expect(judgeFix(pull({ runs: [] }), BRANCH)).toEqual({ state: 'waits', lacks: ['no check has run on its head'] });
    expect(judgeFix(pull({ runs: [{ id: 1, name: 'test', status: 'in_progress', conclusion: null, title: null }] }), BRANCH)).toEqual({ state: 'waits', lacks: ['test not finished'] });
    expect(judgeFix(pull({ runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'failure', title: null }] }), BRANCH)).toEqual({ state: 'refused', why: '#12 is red: test failed' });
    expect(judgeFix(pull({ state: 'closed' }), BRANCH)).toEqual({ state: 'refused', why: '#12 is closed' });
  });
});

describe('the repair events: one sentence and one link each, recorded once', () => {
  it('records the dispatch, the retro, the end and the Omni Loop bug, each naming the cause by 8 characters', () => {
    const repairs = view({
      jobs: [repairJob(1, 1, 'a', attempt('r1', { status: 'done' }))],
      rows: [row({ retro: retro({ class: 'omni-loop' }), fixPr: null, outcome: 'stopped' })],
      reports: new Map([['r1', { state: 'filed', repo: 'vertuoza/vertuo-omni-loop', issue: 3100 }]]),
    });
    const runs = [run(1, 1, failed('a'))];
    const states = prdStates([facts(1)], runs, undefined, undefined, undefined, repairs);
    const next = conclude({ mission: mission(), facts: [facts(1)], states, sent: 0, now: NOW });
    const recorded = recordedKeys([{ kind: 'dispatched', prd: p(1), job: 'a' }, { kind: 'job-ended', prd: p(1), job: 'a' }]);
    const events = eventsOf({ mission: mission(), facts: [facts(1)], states, runs, next, toFleet: true, recorded, repairs });
    expect(events.filter((event) => event.kind !== 'stopped').map(({ kind, role, job, link, sentence }) => [kind, role, job, link, sentence])).toEqual([
      ['repair-started', 'supervisor', 'r1', null, "Sent /omni:repair --mission 12 --prd 1 --job a to the night-shift fleet's runners (repair 1)."],
      ['retro', 'engineer', 'r1', null, "PRD 1's retro [aaaaaaaa] reads omni-loop: The quote total test expects a rounded sum."],
      ['repair-ended', 'supervisor', 'r1', null, "PRD 1's repair [aaaaaaaa] ended stopped."],
      ['bug-reported', 'supervisor', 'r1', 'https://github.com/vertuoza/vertuo-omni-loop/issues/3100', 'PRD 1 met an Omni Loop bug [aaaaaaaa]: reported as #3100.'],
    ]);
    const again = eventsOf({ mission: mission(), facts: [facts(1)], states, runs, next, toFleet: true, recorded: recordedKeys([...events.map(({ kind, prd, job }) => ({ kind, prd, job })), { kind: 'dispatched', prd: p(1), job: 'a' }, { kind: 'job-ended', prd: p(1), job: 'a' }]), repairs });
    expect(again.filter((event) => ['repair-started', 'retro', 'repair-ended', 'bug-reported'].includes(event.kind))).toEqual([]);
  });

  it('says an unreadable repair ended not fixed', () => {
    const repairs = view({ jobs: [repairJob(1, 1, 'a', attempt('r1', { status: 'done' }))], rows: [row({ retro: null, fixPr: null, outcome: 'not fixed' })] });
    const runs = [run(1, 1, failed('a'))];
    const states = prdStates([facts(1)], runs, undefined, undefined, undefined, repairs);
    const next = conclude({ mission: mission(), facts: [facts(1)], states, sent: 0, now: NOW });
    const events = eventsOf({ mission: mission(), facts: [facts(1)], states, runs, next, toFleet: false, recorded: recordedKeys([]), repairs });
    expect(events.filter((event) => event.kind === 'repair-ended').map((event) => event.sentence)).toEqual(["PRD 1's repair ended not fixed: its record line could not be read."]);
  });
});
