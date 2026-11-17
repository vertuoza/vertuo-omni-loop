// A fake fleet runs a mission to Delivered (PRD 2842 s9). The real supervisor and the real job handler run against the
// ledger's in-memory store and runner outcomes the test hands out: no database, no runner, no model call. The mission
// takes two roadmaps, as the store reads them (their rows expand through `expandScope`, blockers included), and a
// plan territory two of its PRDs share.
//
//   roadmap 40   PRD 10 (apps/quotes/)     then PRD 11 (apps/invoices/), which waits on 10
//   roadmap 41   PRD 20 (apps/quotes/pay/) shares ground with PRD 10; PRD 21 (apps/mail/) is free
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { fingerprint } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { JobResult } from '../jobs/worker.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import { expandScope, type PrdFacts, type RoadmapRow } from './supervisor.ts';

const ID = '5d0c3e2a-7b41-4f6d-8a9e-1c2b3d4e5f60';
const START = Date.parse('2027-01-22T09:00:00Z');
const MINUTE = 60_000;
const p = (n: number): PrdNumber => parsePrd(n);

const ROADMAPS: RoadmapRow[][] = [
  [
    { prd: p(10), rowId: 'a1', blockers: [] },
    { prd: p(11), rowId: 'a2', blockers: ['a1'] },
  ],
  [
    { prd: p(20), rowId: 'b1', blockers: [] },
    { prd: p(21), rowId: 'b2', blockers: [] },
  ],
];
const TERRITORY: Readonly<Record<number, string[]>> = {
  10: ['apps/quotes/'],
  11: ['apps/invoices/'],
  20: ['apps/quotes/pay/'],
  21: ['apps/mail/'],
};

const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'with-you',
  status: 'running',
  waitingOn: null,
  parallel: 3,
  scope: { prds: [], roadmaps: [parseIssue(40), parseIssue(41)] },
};

const facts: PrdFacts[] = expandScope(mission.scope.prds, ROADMAPS).map(({ prd, blockers }) => ({
  prd,
  approval: 'standing',
  stage: 'open',
  blockers,
  territory: TERRITORY[prd] ?? null,
}));

/** The mission's job as the ledger hands it out. */
const claimed = (): ClaimedJob => ({
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'acme/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(START + 5 * MINUTE).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
});

/** A fleet: a mission whose clock moves a minute on every run, as its `later` asks. */
function fleet(start = START) {
  const fake = fakeMissionStore({ mission: { ...mission, status: 'draft' }, facts });
  const clock = { now: start };
  const handler = missionHandler({ store: fake.store, refresh: () => Promise.resolve('again'), now: () => clock.now, log: () => undefined });
  /** One run of the mission, a minute after the last. */
  const run = (): Promise<JobResult> => {
    clock.now += MINUTE;
    return handler(claimed());
  };
  const lines = () => fake.jobs().map((job) => job.line);
  return { fake, run, lines };
}

describe('a fake fleet delivers a two-roadmap mission (PRD 2842 s9)', () => {
  it('runs from Start to Delivered: blockers wait, overlapping ground waits, Ready waits for a merge, Held goes again once', async () => {
    const { fake, run, lines } = fleet();

    // A draft runs nothing before a person presses Start.
    expect(await run()).toMatchObject({ outcome: 'skipped' });
    expect(fake.jobs()).toEqual([]);

    // Start: the startable PRDs go at once. PRD 20 shares ground with PRD 10, PRD 11 waits on PRD 10.
    fake.status('running');
    expect(await run()).toMatchObject({ outcome: 'later' });
    expect(lines()).toEqual(['/omni:yolo 10 --for-review', '/omni:yolo 21 --for-review']);
    for (const job of fake.jobs()) {
      expect(checkRunnerLine(job.line)).toMatchObject({ ok: true, skill: 'yolo' });
      expect(job).toMatchObject({ toFleet: 'night-shift', sentByApp: 'omni-app' });
    }
    expect(fake.events().map(({ kind, role, actor, prd }) => [kind, role, actor, prd])).toEqual([
      ['dispatched', 'supervisor', 'agent', p(10)],
      ['dispatched', 'supervisor', 'agent', p(21)],
    ]);

    // Nothing moved: a run a minute on sends nothing twice.
    await run();
    expect(lines()).toEqual(['/omni:yolo 10 --for-review', '/omni:yolo 21 --for-review']);

    // PRD 21 is held: it goes again once.
    fake.end(p(21), { status: 'done', outcome: 'held' });
    await run();
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:10:run:1`, `mission:${ID}:prd:21:run:1`, `mission:${ID}:prd:21:run:2`]);

    // PRD 10 is Ready: it waits for a person to merge it. Its ground is free, so PRD 20 goes; PRD 11 still waits.
    fake.end(p(10), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/91' });
    fake.set(p(10), { stage: 'ready' });
    await run();
    expect(lines().slice(3)).toEqual(['/omni:yolo 20 --for-review']);
    expect(fake.mission().waitingOn).toBe('PRD 10: merge it');
    expect(fake.mission().status).toBe('running');

    // The merge sends what it unblocks, within one run.
    fake.set(p(10), { stage: 'merged' });
    await run();
    expect(lines().slice(4)).toEqual(['/omni:yolo 11 --for-review']);

    // The rest end ready and are merged: the mission reads Delivered only now.
    fake.end(p(21), { status: 'done', outcome: 'ready' });
    fake.end(p(20), { status: 'done', outcome: 'ready' });
    fake.end(p(11), { status: 'done', outcome: 'ready' });
    fake.set(p(21), { stage: 'merged' });
    fake.set(p(20), { stage: 'merged' });
    await run();
    expect(fake.mission().status).not.toBe('delivered');
    fake.set(p(11), { stage: 'merged' });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.mission()).toMatchObject({ status: 'delivered', waitingOn: null, nextWakeAt: null });
    expect(fake.events().at(-1)).toMatchObject({ kind: 'delivered' });

    // Every job was sent by the app, once per key, and a Held PRD was sent no more than twice.
    expect(new Set(fake.jobs().map((job) => job.key)).size).toBe(fake.jobs().length);
    expect(lines()).toHaveLength(5);
    expect(fake.events().map((event) => event.actor)).toEqual(fake.events().map(() => 'agent'));
  });

  it('never sends the overlapping PRD while the PRD it shares ground with runs', async () => {
    const { fake, run, lines } = fleet();
    fake.status('running');
    await run();
    await run();
    await run();
    expect(lines()).not.toContain('/omni:yolo 20 --for-review');
    expect(lines()).not.toContain('/omni:yolo 11 --for-review');
  });
});

describe('a fake fleet waits out a provider limit (PRD 2949, BR-PRODUCT-139)', () => {
  const NIGHT = Date.parse('2027-01-23T02:00:00Z');
  const RESET = '2027-01-23T04:00:00.000Z';

  it('a limit at 02:00 keeps the PRD in the mission, its run and its place; the resume goes at the reset and the PRD reaches ready, no job lost', async () => {
    const { fake, run, lines } = fleet(NIGHT - MINUTE);
    fake.status('running');
    await run();
    expect(lines()).toEqual(['/omni:yolo 10 --for-review', '/omni:yolo 21 --for-review']);

    // 02:00: PRD 10's runner has no account left. The database queues the resume after the reset, on the same try.
    fake.limit(p(10), RESET);
    await run();
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: 'PRD 10: waiting for a provider limit until 04:00 UTC' });
    // It still holds its place: nothing is sent for it, nor beside it, and its run is still run 1.
    expect(lines()).toEqual(['/omni:yolo 10 --for-review', '/omni:yolo 21 --for-review']);
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:10:run:1`, `mission:${ID}:prd:21:run:1`]);
    expect(fake.events().map((event) => event.kind)).not.toContain('stopped');

    // The wait passes minute by minute without a new job.
    for (let minute = 0; minute < 5; minute += 1) await run();
    expect(fake.jobs()).toHaveLength(2);

    // The reset: a runner claims the resume, and the PRD ends ready.
    fake.end(p(10), { status: 'running' });
    await run();
    expect(fake.mission().waitingOn).toBeNull();
    fake.end(p(10), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/91' });
    fake.end(p(21), { status: 'done', outcome: 'ready' });
    fake.set(p(10), { stage: 'ready' });
    fake.set(p(21), { stage: 'ready' });
    await run();
    expect(fake.mission().waitingOn).toContain('PRD 10: merge it');

    // No job was lost: the limit and its resume are one chain of run 1, and no run was sent again.
    expect(fake.jobs().filter((job) => job.prd === p(10)).map((job) => job.key)).toEqual([`mission:${ID}:prd:10:run:1`]);
    expect(fake.events().map((event) => event.sentence)).toContain('PRD 10 met a provider limit: its resume waits for the reset and carries the work on.');
    expect(fake.events().map((event) => event.sentence).join(' ')).not.toMatch(/lost|failed|stops/);
  });

  it('waits for room when no runner of the fleet can take its job, and runs once one can', async () => {
    const { fake, run } = fleet();
    fake.runners([{ repos: ['acme/widgets'], slots: 1, used: 1, lastSeenAt: new Date(START).toISOString(), health: null }]);
    fake.status('running');
    await run();
    expect(fake.mission().waitingOn).toBe("PRD 10: waiting for room on the fleet's runners · PRD 21: waiting for room on the fleet's runners");
    fake.runners([{ repos: ['acme/widgets'], slots: 1, used: 0, lastSeenAt: new Date(START + 2 * MINUTE).toISOString(), health: null }]);
    await run();
    expect(fake.mission().waitingOn).toBeNull();
  });
});

describe('a fake fleet repairs a step that broke at 02:00 (PRD 2980, BR-PRODUCT-139)', () => {
  const NIGHT = Date.parse('2027-01-23T02:00:00Z');
  const BRANCH = 'mission/12-faster-quotes';

  /** A pull request into the mission branch: the repair's fix, green, unless told otherwise. */
  const pull = (number: number, over: Partial<PullRead> = {}): PullRead => ({
    number,
    url: `https://github.com/acme/widgets/pull/${String(number)}`,
    title: `fix: #${String(number)}`,
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

  /** What `/omni:repair` ends on for PRD 10: a code cause, its fix #51 into the mission branch. */
  function repaired(): string {
    const cause = { class: 'code' as const, place: 'apps/quotes/total.ts', signature: 'AssertionError: expected 10.01 to be 10' };
    const print = fingerprint(cause);
    const retro = { cause: 'The quote total is not rounded.', ...cause, evidence: ['The test compares an unrounded total.'], proposedFix: 'Round the total before it is compared.', fingerprint: print };
    return `02:20:00 ${repairRecordLine({ v: 1, mission: 12, prd: p(10), fingerprint: print, class: 'code', retro, fix: parsePr(51), report: null })}`;
  }

  it('sends a repair, lands its fix on the mission branch, sends the step again, and the PRD reaches ready', async () => {
    const pulls: Record<number, PullRead> = { 51: pull(51), 91: pull(91, { reviews: [] }) };
    const merges: number[] = [];
    const joins: MissionJoins = {
      read: (at) => Promise.resolve({ ...(pulls[at.pr] ?? pull(at.pr)) }),
      merge: (at) => {
        merges.push(at.pr);
        const one = pulls[at.pr];
        if (one) pulls[at.pr] = { ...one, merged: true, state: 'closed' };
        return Promise.resolve({ ok: true });
      },
    };
    const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };
    const fake = fakeMissionStore({ mission: { ...mission, level: 'own-branch', status: 'running' }, facts });
    const clock = { now: NIGHT - MINUTE };
    const handler = missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => clock.now, log: () => undefined });
    const run = (): Promise<JobResult> => {
      clock.now += MINUTE;
      return handler(claimed());
    };

    await run();
    expect(fake.jobs().map((job) => job.line)).toEqual([`/omni:yolo 10 --for-review --base ${BRANCH}`, `/omni:yolo 21 --for-review --base ${BRANCH}`]);

    // 02:00: PRD 10's test breaks and its job fails. The mission sends a repair first in line, not a stop.
    fake.end(p(10), { status: 'failed', reason: 'exit code 1' });
    await run();
    expect(fake.repairJobs().map((job) => job.line)).toEqual(['/omni:repair --mission 12 --prd 10 --job job-1']);
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: 'PRD 10: repairing (1 of 3) · 8 left in this mission' });

    // The repair finds the cause and opens its fix into the mission branch: green, it lands, and the step goes again.
    fake.endRepairJob(p(10), { status: 'done' }, repaired());
    await run();
    expect(merges).toEqual([51]);
    expect(fake.jobs().filter((job) => job.prd === p(10)).map((job) => job.key)).toEqual([`mission:${ID}:prd:10:run:1`, `mission:${ID}:prd:10:run:2`]);

    // The step passes on the fixed branch: the repair ended fixed, and the PRD is ready.
    fake.end(p(10), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/91' });
    await run();
    expect(fake.repairRows().map((row) => [row.number, row.outcome, row.fixPr])).toEqual([[1, 'fixed', 'https://github.com/acme/widgets/pull/51']]);
    expect(fake.events().map((event) => event.kind)).toEqual(expect.arrayContaining(['repair-started', 'retro', 'repair-ended', 'prd-ready']));
    expect(fake.events().map((event) => event.kind)).not.toContain('stopped');
    expect(fake.mission().status).toBe('running');
    // Nothing reached the default branch: the fix merged into the mission branch only (N-PRODUCT-15).
    expect(merges).not.toContain(91);
  });
});
