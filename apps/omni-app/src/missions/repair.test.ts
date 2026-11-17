// A mission repairs a failed step on fake runners (PRD 2980 s5): the real job handler and supervisor, against the mission's store
// in memory (its repairs capped as mission_repairs caps them), a fake GitHub for the fix pull requests, and record lines the test
// hands out as `/omni:repair` writes them. No database, no runner, no model call, no GitHub.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { fingerprint, type RepairClass } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { Merged, MissionJoins } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
const p = (n: number): PrdNumber => parsePrd(n);

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'own-branch',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [p(1)], roadmaps: [] },
  ...over,
});
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });

const claimed: ClaimedJob = {
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'acme/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(NOW + 300_000).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
};

/** What `/omni:repair` ends on: its record line, for PRD `prd`, class `kind`, the cause `place` names, and its fix or report. */
function line(
  prd: number,
  kind: RepairClass,
  { place = 'apps/quotes/total.ts', fix = null as number | null, message = 'expected 10.01 to be 10', clean = true, report: words = 'the runner work command crashed' } = {},
): string {
  const cause = { class: kind, place, signature: `AssertionError: ${message}` };
  const print = fingerprint(cause);
  const retro = { cause: 'The quote total is not rounded.', ...cause, evidence: ['The test compares an unrounded total.'], proposedFix: 'Round the total before it is compared.', fingerprint: print };
  const report = kind === 'omni-loop' && clean ? { kitVersion: '0.0.659', command: '/omni:yolo', class: kind, message: words, fingerprint: print } : null;
  return `12:00:00 working…\n12:00:01 ${repairRecordLine({ v: 1, mission: 12, prd: p(prd), fingerprint: print, class: kind, retro, fix: fix === null ? null : parsePr(fix), report })}`;
}

/** A fix pull request into the mission branch, green unless told otherwise. */
const fixPull = (number: number, over: Partial<PullRead> = {}): PullRead => ({
  number,
  url: `https://github.com/acme/widgets/pull/${String(number)}`,
  title: 'fix: round the quote total',
  state: 'open',
  draft: false,
  merged: false,
  base: BRANCH,
  defaultBranch: 'main',
  head: 'f'.repeat(40),
  runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
  statuses: [],
  reviews: [],
  items: { ranks: [] },
  ...over,
});

/** A GitHub holding `pulls`: a merge marks one merged, unless `refuse` says why not. */
function githubOf(pulls: Record<number, PullRead>, refuse: string | null = null) {
  const merges: number[] = [];
  const joins: MissionJoins = {
    read: (at) => {
      const pull = pulls[at.pr];
      return pull ? Promise.resolve({ ...pull }) : Promise.reject(new Error(`no pull request #${String(at.pr)}`));
    },
    merge: (at): Promise<Merged> => {
      merges.push(at.pr);
      if (refuse !== null) return Promise.resolve({ ok: false, why: refuse });
      const pull = pulls[at.pr];
      if (pull) pulls[at.pr] = { ...pull, merged: true, state: 'closed' };
      return Promise.resolve({ ok: true });
    },
  };
  return { merges, joins };
}

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

function setup({ mission = record(), all = [facts(1)], joins = null as MissionJoins | null } = {}) {
  const fake = fakeMissionStore({ mission, facts: all });
  const run = () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run };
}

type Fake = ReturnType<typeof setup>['fake'];

const kinds = (fake: Fake, kind: string) => fake.events().filter((event) => event.kind === kind);

/** Sends PRD 1's step and fails it, then sends its repair. */
async function failed(fake: Fake, run: () => Promise<unknown>, prd = p(1)) {
  await run();
  fake.end(prd, { status: 'failed', reason: 'exit code 1' });
  await run();
}

describe('a failed step is repaired (AC-1)', () => {
  it('sends a repair first in line, as the app, and the PRD reads Repairing (1 of 3)', async () => {
    const { fake, run } = setup();
    await failed(fake, run);
    const [repair] = fake.repairJobs();
    expect(repair).toMatchObject({ key: `mission:${ID}:prd:1:repair:1`, line: '/omni:repair --mission 12 --prd 1 --job job-1', toFleet: 'night-shift' });
    expect(checkRunnerLine(repair?.line ?? '')).toMatchObject({ ok: true, skill: 'repair' });
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: 'PRD 1: repairing (1 of 3) · 8 left in this mission' });
    expect(kinds(fake, 'repair-started').map((event) => [event.role, event.actor, event.sentence])).toEqual([
      ['supervisor', 'agent', "Sent /omni:repair --mission 12 --prd 1 --job job-1 to the night-shift fleet's runners (repair 1)."],
    ]);
    expect(kinds(fake, 'stopped')).toEqual([]);
    // A run a minute on sends nothing twice.
    await run();
    expect(fake.repairJobs()).toHaveLength(1);
  });

  it('lands its fix on the mission branch once green, sends the step again, and the repair ends fixed', async () => {
    const gh = githubOf({ 51: fixPull(51, { runs: [{ id: 1, name: 'test', status: 'in_progress', conclusion: null, title: null }] }) });
    const { fake, run } = setup({ joins: gh.joins });
    await failed(fake, run);
    fake.endRepairJob(p(1), { status: 'done' }, line(1, 'code', { fix: 51 }));
    await run();
    expect(gh.merges).toEqual([]);
    expect(fake.mission().waitingOn).toBe('PRD 1: repairing (1 of 3) · 8 left in this mission: its fix #51 waits: test not finished');
    expect(kinds(fake, 'retro').map((event) => [event.role, event.link])).toEqual([['engineer', 'https://github.com/acme/widgets/pull/51']]);

    const green = githubOf({ 51: fixPull(51) });
    const after = setupAgain(fake, green.joins);
    await after();
    expect(green.merges).toEqual([51]);
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:1:run:1`, `mission:${ID}:prd:1:run:2`]);
    expect(fake.jobs()[1]?.line).toBe(`/omni:yolo 1 --for-review --base ${BRANCH}`);

    fake.end(p(1), { status: 'done', outcome: 'review', prUrl: 'https://github.com/acme/widgets/pull/41' });
    await after();
    expect(fake.repairRows().map((row) => [row.number, row.outcome])).toEqual([[1, 'fixed']]);
    expect(kinds(fake, 'repair-ended').map((event) => event.sentence)).toEqual([expect.stringMatching(/^PRD 1's repair \[[0-9a-f]{8}\] ended fixed\.$/) as unknown]);
  });

  it('stops the PRD, saying why, when its fix cannot land on the mission branch', async () => {
    const gh = githubOf({ 51: fixPull(51) }, 'GitHub refused the merge: Merge conflict');
    const { fake, run } = setup({ joins: gh.joins });
    await failed(fake, run);
    fake.endRepairJob(p(1), { status: 'done' }, line(1, 'code', { fix: 51 }));
    await run();
    expect(fake.mission()).toMatchObject({ status: 'stopped', waitingOn: 'PRD 1 stopped: its fix #51 cannot land on the mission branch: GitHub refused the merge: Merge conflict. Take it to ready by hand and the mission carries on.' });
  });

  it('a cancel sends nothing', async () => {
    const { fake, run } = setup();
    await run();
    fake.end(p(1), { status: 'cancelled' });
    await run();
    expect(fake.repairJobs()).toEqual([]);
  });
});

/** The handler again, on the same store, with another GitHub. */
function setupAgain(fake: Fake, joins: MissionJoins) {
  return () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
}

describe('a flake is retried, a person\'s decision stops (AC-9)', () => {
  it('sends the step once more with no fix for a flake', async () => {
    const { fake, run } = setup();
    await failed(fake, run);
    fake.endRepairJob(p(1), { status: 'done' }, line(1, 'flake', { place: 'pnpm test', message: 'socket hang up' }));
    await run();
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:1:run:1`, `mission:${ID}:prd:1:run:2`]);
    expect(fake.repairRows()[0]).toMatchObject({ fixPr: null, outcome: null });
  });

  it('stops its PRD with the question for a person', async () => {
    const { fake, run } = setup();
    await failed(fake, run);
    fake.endRepairJob(p(1), { status: 'done' }, line(1, 'person', { place: 'deploy key', message: 'Permission denied' }));
    await run();
    expect(fake.mission().status).toBe('stopped');
    expect(fake.mission().waitingOn).toMatch(/^PRD 1 stopped: its repair \[[0-9a-f]{8}\] needs a person: The quote total is not rounded\. Round the total before it is compared\. Take it/);
    expect(fake.repairRows()[0]?.outcome).toBe('stopped');
  });
});

describe('an Omni Loop bug is reported once, scrubbed (AC-5, AC-6)', () => {
  it('adds the scrubbed report to the ledger, then waits on the Omni Loop bug it was filed as', async () => {
    const { fake, run } = setup();
    await failed(fake, run);
    // The retro, kept in the workspace, names its repository, login and path; the report the skill scrubbed still names the
    // workspace's own words, which the App scrubs out again with the names it knows the workspace by.
    fake.endRepairJob(p(1), { status: 'done' }, line(1, 'omni-loop', { place: 'omni runner work', message: 'acme/widgets failed for @ada in /home/ada/acme/widgets', report: 'runner work crashed on widgets for acme' }));
    await run();
    const [added] = fake.added();
    expect(added).toMatchObject({ kind: 'bug-report', subject: 'vertuoza/vertuo-omni-loop', lane: 'bug-report' });
    const text = JSON.stringify(added?.payload);
    for (const leak of ['acme', 'widgets', 'ada', '/home']) expect(text).not.toContain(leak);
    expect(text).toContain('runner work crashed on <name> for <name>');
    expect(fake.mission().waitingOn).toMatch(/^PRD 1 stopped: its Omni Loop bug report \[[0-9a-f]{8}\] is being filed\./);

    const [row] = fake.repairRows();
    fake.fileBug(row?.fingerprint ?? '', 3100);
    fake.status('running');
    await run();
    expect(fake.mission().waitingOn).toBe('PRD 1 stopped: Waits on Omni Loop bug #3100. Take it to ready by hand and the mission carries on.');
    expect(kinds(fake, 'bug-reported').map((event) => event.link)).toEqual(['https://github.com/vertuoza/vertuo-omni-loop/issues/3100']);
    expect(fake.added()).toHaveLength(1);
  });

  it('files nothing when the report cannot be proven clean, and says why on the mission alone', async () => {
    const { fake, run } = setup();
    await failed(fake, run);
    // The repair met a token it could not scrub out of the message: it left its report null, as /omni:repair does.
    fake.endRepairJob(p(1), { status: 'done' }, line(1, 'omni-loop', { place: 'omni runner work', clean: false }));
    await run();
    expect(fake.added()).toEqual([]);
    expect(fake.mission().waitingOn).toMatch(/^PRD 1 stopped: its Omni Loop bug report \[[0-9a-f]{8}\] was not sent: its repair could not make one it could prove clean\./);
    expect(kinds(fake, 'bug-reported')).toEqual([]);
  });
});

describe('the budget: 3 per cause, 9 per mission (AC-3, AC-4, AC-7, AC-8)', () => {
  /** Fails PRD `prd`'s current step, repairs it as a flake of one cause, and runs until the step is sent again. */
  async function failAndFlake(fake: Fake, run: () => Promise<unknown>, prd = p(1), place = 'pnpm test') {
    fake.end(prd, { status: 'failed', reason: 'exit code 1' });
    await run();
    fake.endRepairJob(prd, { status: 'done' }, line(Number(prd), 'flake', { place, message: 'socket hang up' }));
    await run();
  }

  it('stops a cause after 3 repairs in the round, explaining, and the database keeps no 4th', async () => {
    const { fake, run } = setup();
    await run();
    for (let n = 0; n < 3; n += 1) await failAndFlake(fake, run);
    expect(fake.repairRows().map((row) => [row.number, row.outcome])).toEqual([[1, 'not fixed'], [2, 'not fixed'], [3, null]]);
    await failAndFlake(fake, run);
    expect(fake.repairRows()).toHaveLength(3);
    expect(fake.mission().status).toBe('stopped');
    expect(fake.mission().waitingOn).toMatch(/^PRD 1 stopped: its cause \[[0-9a-f]{8}\] was repaired 3 times: The quote total is not rounded\. Tried: retry not fixed, retry not fixed, retry not fixed\. Proposed fix: Round the total before it is compared\. Resume gives each cause 3 more \(6 of 9 left in this mission\)\. Take it to ready by hand/);
  });

  it('a Resume opens a new round: the cause gets 3 again, and the mission\'s 9 stay counted', async () => {
    const { fake, run } = setup();
    await run();
    for (let n = 0; n < 4; n += 1) await failAndFlake(fake, run);
    expect(fake.mission().status).toBe('stopped');
    fake.resume();
    await run();
    expect(fake.repairRows().map((row) => [row.round, row.number])).toEqual([[1, 1], [1, 2], [1, 3], [2, 1]]);
    expect(fake.jobs()).toHaveLength(5);
    fake.end(p(1), { status: 'failed', reason: 'exit code 1' });
    await run();
    expect(fake.mission().waitingOn).toBe('PRD 1: repairing (2 of 3) · 4 left in this mission');
  });

  it('never runs a 10th repair: the PRD stops saying the mission spent its 9', async () => {
    const { fake, run } = setup({ mission: record({ parallel: 1, scope: { prds: [p(1), p(2), p(3), p(4)], roadmaps: [] } }), all: [facts(1), facts(2), facts(3), facts(4)] });
    await run();
    // Three PRDs, three causes each: 9 repairs, each a flake of its own cause.
    for (const prd of [p(1), p(2), p(3)]) {
      for (const place of ['pnpm test', 'pnpm lint', 'pnpm build']) await failAndFlake(fake, run, prd, place);
      fake.end(prd, { status: 'done', outcome: 'ready' });
      fake.set(prd, { stage: 'merged' });
      await run();
    }
    expect(fake.repairRows()).toHaveLength(9);
    fake.end(p(4), { status: 'failed', reason: 'exit code 1' });
    await run();
    expect(fake.repairJobs()).toHaveLength(9);
    expect(fake.mission().waitingOn).toBe('PRD 4 stopped: its job failed: exit code 1, and the mission spent its 9 repairs. Take it to ready by hand and the mission carries on.');
  });

  it('a lost repair spends nothing; an unreadable record spends one and is repaired again', async () => {
    const { fake, run } = setup();
    await failed(fake, run);
    fake.loseRepair(p(1));
    await run();
    expect(fake.mission().waitingOn).toBe('PRD 1: repairing (1 of 3) · 8 left in this mission');
    expect(fake.repairRows()).toEqual([]);
    fake.endRepairJob(p(1), { status: 'done' }, '12:00:00 omni repair: {not json');
    await run();
    expect(fake.repairRows().map((row) => [row.retro, row.outcome])).toEqual([[null, 'not fixed']]);
    expect(fake.repairJobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:1:repair:1`, `mission:${ID}:prd:1:repair:2`]);
    expect(fake.mission().waitingOn).toBe('PRD 1: repairing (2 of 3) · 7 left in this mission');
    expect(kinds(fake, 'repair-ended').map((event) => event.sentence)).toEqual(["PRD 1's repair ended not fixed: its record line could not be read."]);
  });
});
