// A PRD stopped on an Omni Loop bug comes back once the bug is fixed (PRD 3088 s5) on fake runners: the real job handler and
// supervisor, against the mission's store in memory, a fake read of the kit the repository pins, and the record line the test hands
// out as `/omni:repair` writes it. No database, no runner, no model call, no GitHub.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { fingerprint } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
import type { ClaimedJob, RefreshJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler, missionJob } from './job.ts';
import type { KitAt, MissionKits } from './repair.github.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
const p = (n: number): PrdNumber => parsePrd(n);
const UPDATE = 'Fixed in v0.0.690: update the kit to resume (omni update)';

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
const facts = (n: number): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`] });

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

/** What `/omni:repair` ends on when it met an Omni Loop bug: its record line, with a scrubbed report. */
function omniLoopLine(prd: number): string {
  const cause = { class: 'omni-loop' as const, place: 'omni runner work', signature: 'TypeError: cannot read the plan' };
  const print = fingerprint(cause);
  const retro = { cause: 'omni runner work crashed.', ...cause, evidence: ['The runner stopped on its own command.'], proposedFix: 'Read the plan first.', fingerprint: print };
  const report = { kitVersion: '0.0.659', command: '/omni:yolo', class: 'omni-loop' as const, message: 'runner work crashed', fingerprint: print };
  return `12:00:01 ${repairRecordLine({ v: 1, mission: 12, prd: p(prd), fingerprint: print, class: 'omni-loop', retro, fix: null, report })}`;
}

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

/** A repository pinning `version` (null: it does not read), recording each read. */
function kitsAt(version: string | null) {
  const reads: KitAt[] = [];
  const state = { version };
  const kits: MissionKits = {
    pinned: (at) => {
      reads.push(at);
      return Promise.resolve(state.version);
    },
  };
  return { reads, kits, pin: (next: string | null) => (state.version = next) };
}

/** PRD 1 failed, its repair met an Omni Loop bug, filed as #3100: the PRD stopped on it, the mission with it. */
async function stoppedOnBug(kit: string | null, mission = record()) {
  const fake = fakeMissionStore({ mission, facts: [facts(1)] });
  const kits = kitsAt(kit);
  const run = () => missionHandler({ store: fake.store, branches, kits: kits.kits, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  await run();
  fake.end(p(1), { status: 'failed', reason: 'exit code 1' });
  await run();
  fake.endRepairJob(p(1), { status: 'done' }, omniLoopLine(1));
  await run();
  const print = fake.repairRows()[0]?.fingerprint ?? '';
  fake.fileBug(print, 3100);
  fake.status('running');
  await run();
  expect(fake.mission()).toMatchObject({ status: 'stopped', waitingOn: 'PRD 1 stopped: Waits on Omni Loop bug #3100. Take it to ready by hand and the mission carries on.' });
  return { fake, run, kits, print };
}

const told = (fake: ReturnType<typeof fakeMissionStore>) => fake.events().filter((event) => event.kind === 'bug-fixed').map((event) => [event.prd, event.link, event.sentence]);
const ISSUE = 'https://github.com/vertuoza/vertuo-omni-loop/issues/3100';

describe('a PRD stopped on an Omni Loop bug, once it is fixed', () => {
  it('AC-6: is sent its step again on a kit at the fix\'s version, spending no repair, and the room says so', async () => {
    const { fake, run, kits, print } = await stoppedOnBug('0.0.690');
    expect(kits.reads).toEqual([]);
    fake.moveBug(print, 'fixed', '0.0.690');
    fake.status('running');
    await run();
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:1:run:1`, `mission:${ID}:prd:1:run:2`]);
    expect(fake.repairJobs()).toHaveLength(1);
    expect(kits.reads).toEqual([{ installation: 1, repo: 'acme/widgets', ref: BRANCH }]);
    expect(fake.mission().status).toBe('running');
    expect(told(fake)).toEqual([
      [p(1), ISSUE, 'Omni Loop bug #3100 is fixed in v0.0.690.'],
      [p(1), ISSUE, 'PRD 1 resumed: the kit is at v0.0.690.'],
    ]);
    // Once sent again it is no longer waiting: the kit is not read again, and nothing is told twice.
    await run();
    expect(kits.reads).toHaveLength(1);
    expect(told(fake)).toHaveLength(2);
  });

  it('AC-7: on an older kit says to update it, sends nothing, and goes once the kit catches up', async () => {
    const { fake, run, kits, print } = await stoppedOnBug('0.0.689');
    fake.moveBug(print, 'fixed', '0.0.690');
    fake.status('running');
    await run();
    expect(fake.jobs()).toHaveLength(1);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: `PRD 1: ${UPDATE}` });
    expect(told(fake)).toEqual([[p(1), ISSUE, `Omni Loop bug #3100 is fixed in v0.0.690. ${UPDATE}.`]]);
    await run();
    expect(fake.jobs()).toHaveLength(1);
    kits.pin('0.0.691');
    await run();
    expect(fake.jobs().map((job) => job.run)).toEqual([1, 2]);
    expect(fake.repairJobs()).toHaveLength(1);
    expect(told(fake).map(([, , sentence]) => sentence)).toEqual([`Omni Loop bug #3100 is fixed in v0.0.690. ${UPDATE}.`, 'PRD 1 resumed: the kit is at v0.0.690.']);
  });

  it('AC-7: a kit that does not read counts as older', async () => {
    const { fake, run, print } = await stoppedOnBug(null);
    fake.moveBug(print, 'fixed', '0.0.690');
    fake.status('running');
    await run();
    expect(fake.jobs()).toHaveLength(1);
    expect(fake.mission().waitingOn).toBe(`PRD 1: ${UPDATE}`);
  });

  it('a stopped mission is told, and waits for its own Resume; the PRD then goes by the same rule', async () => {
    const { fake, run, kits, print } = await stoppedOnBug('0.0.690');
    fake.moveBug(print, 'fixed', '0.0.690');
    // Woken while stopped (the team tells it): it records the fix, sends nothing, and stays stopped.
    await run();
    expect(fake.jobs()).toHaveLength(1);
    expect(kits.reads).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'stopped', waitingOn: 'PRD 1 stopped: Omni Loop bug #3100 is fixed in v0.0.690: resume the mission to carry on. Take it to ready by hand and the mission carries on.' });
    expect(told(fake)).toEqual([[p(1), ISSUE, 'Omni Loop bug #3100 is fixed in v0.0.690.']]);
    fake.resume();
    await run();
    expect(fake.jobs().map((job) => job.run)).toEqual([1, 2]);
    expect(fake.repairJobs()).toHaveLength(1);
  });

  it('a bug merged but not released yet keeps the PRD stopped on it', async () => {
    const { fake, run, print } = await stoppedOnBug('0.0.690');
    fake.moveBug(print, 'merged');
    fake.status('running');
    await run();
    expect(fake.jobs()).toHaveLength(1);
    expect(fake.mission().status).toBe('stopped');
    expect(told(fake)).toEqual([]);
  });
});

describe('a PRD stopped on an Omni Loop bug that will not be fixed', () => {
  it('AC-8: the room says to take it by hand, and the PRD stays stopped, even after a Resume', async () => {
    const { fake, run, print } = await stoppedOnBug('0.0.690');
    fake.moveBug(print, 'wont-fix');
    fake.status('running');
    await run();
    expect(told(fake)).toEqual([[p(1), ISSUE, "Omni Loop bug #3100 won't be fixed: take this PRD by hand."]]);
    expect(fake.mission()).toMatchObject({ status: 'stopped', waitingOn: "PRD 1 stopped: Omni Loop bug #3100 won't be fixed: take this PRD by hand. Take it to ready by hand and the mission carries on." });
    fake.resume();
    await run();
    expect(fake.jobs()).toHaveLength(1);
    expect(told(fake)).toHaveLength(1);
  });
});

describe('the bug team tells the paused or stopped missions that waited on a bug (AC-8)', () => {
  it('wakes each, by its mission job, so it records the bug\'s move once', async () => {
    const team = record({ id: '7e2a9c40-7e1b-4f36-8a20-9b3c1d4e5f60', repo: 'vertuoza/vertuo-omni-loop', scope: { prds: [], roadmaps: [] }, kind: 'omni-bugs', level: 'with-you' });
    const holders = [{ id: ID, repo: 'acme/widgets' }];
    const fake = fakeMissionStore({ mission: team, facts: [], team: { bugs: [], holders } });
    const woken: RefreshJob[] = [];
    const refresh = (job: RefreshJob) => {
      woken.push(job);
      return Promise.resolve('again');
    };
    await missionHandler({ store: fake.store, refresh, now: () => NOW, log: () => undefined })({ ...claimed, key: `mission:${team.id}`, payload: { mission: team.id } });
    expect(woken).toEqual([missionJob(ID, 'acme/widgets')]);
  });
});
