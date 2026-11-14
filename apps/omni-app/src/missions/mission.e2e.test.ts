// A fake fleet runs a mission to Delivered (PRD 2842 s9). The real supervisor and the real job handler run against the
// ledger's in-memory store and runner outcomes the test hands out: no database, no runner, no model call. The mission
// takes two roadmaps, as the store reads them (their rows expand through `expandScope`, blockers included), and a
// plan territory two of its PRDs share. Since PRD 2871 each build is sent for review and handed to the Reviewer.
//
//   roadmap 40   PRD 10 (apps/quotes/)     then PRD 11 (apps/invoices/), which waits on 10
//   roadmap 41   PRD 20 (apps/quotes/pay/) shares ground with PRD 10; PRD 21 (apps/mail/) is free
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { JobResult } from '../jobs/worker.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
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
function fleet() {
  const fake = fakeMissionStore({ mission: { ...mission, status: 'draft' }, facts });
  const clock = { now: START };
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

  it('hands each build to the Reviewer (PRD 2871): PRD 21 passes in round 1; PRD 10 goes changes, fix, pass', async () => {
    const { fake, run, lines } = fleet();
    const pr = (n: number) => `https://github.com/acme/widgets/pull/${String(n)}`;
    const review = (n: number, id: number) => `${pr(n)}#pullrequestreview-${String(id)}`;
    fake.status('running');
    await run();
    expect(lines()).toEqual(['/omni:yolo 10 --for-review', '/omni:yolo 21 --for-review']);

    // Both builds ship and leave their PR a draft: the Reviewer's round 1 goes for each, under its own key.
    fake.end(p(10), { status: 'done', outcome: 'review', prUrl: pr(91) });
    fake.end(p(21), { status: 'done', outcome: 'review', prUrl: pr(92) });
    await run();
    expect(lines().slice(2)).toEqual(['/omni:review 10', '/omni:review 21']);
    expect(fake.jobs().slice(2).map((job) => job.key)).toEqual([`mission:${ID}:prd:10:run:1:review:1`, `mission:${ID}:prd:21:run:1:review:1`]);

    // PRD 21 passes: the Reviewer marked it ready, it waits for a merge. PRD 10 gets two findings: the fix goes.
    fake.end(p(21), { status: 'done', outcome: 'ready', prUrl: pr(92), posted: { findings: 0, url: review(92, 1) } });
    fake.end(p(10), { status: 'done', outcome: 'changes', prUrl: pr(91), posted: { findings: 2, url: review(91, 2) } });
    await run();
    expect(lines().slice(4)).toEqual(['/omni:yolo-fix 10 --for-review']);
    expect(fake.jobs().at(-1)?.key).toBe(`mission:${ID}:prd:10:run:1:fix:1`);
    expect(fake.mission().waitingOn).toBe('PRD 21: merge it');

    // A replay, and two runs at once, send nothing twice.
    await run();
    fake.together(2);
    await Promise.all([run(), run()]);
    expect(lines()).toHaveLength(5);

    // The fix ships for review: round 2 goes, and passes.
    fake.end(p(10), { status: 'done', outcome: 'review', prUrl: pr(91) });
    fake.together(2);
    await Promise.all([run(), run()]);
    expect(lines().slice(5)).toEqual(['/omni:review 10']);
    expect(fake.jobs().at(-1)?.key).toBe(`mission:${ID}:prd:10:run:1:review:2`);
    fake.end(p(10), { status: 'done', outcome: 'ready', prUrl: pr(91), posted: { findings: 0, url: review(91, 3) } });
    await run();
    expect(fake.mission().waitingOn).toBe('PRD 10: merge it · PRD 21: merge it');

    // Each verdict is one reviewed row, the Reviewer's, as an agent, linking its review, in the order the jobs were sent.
    expect(fake.events().filter((event) => event.kind === 'reviewed').map(({ role, actor, prd, link, sentence }) => [role, actor, prd, link, sentence])).toEqual([
      ['reviewer', 'agent', p(10), review(91, 2), 'Changes asked: 2 findings, round 1/2.'],
      ['reviewer', 'agent', p(21), review(92, 1), 'Passed, round 1 of 2: marked ready.'],
      ['reviewer', 'agent', p(10), review(91, 3), 'Passed, round 2 of 2: marked ready.'],
    ]);
    // Every key once, even from two runs at once (the mission's lane keeps its runs one at a time in production).
    expect(new Set(fake.jobs().map((job) => job.key)).size).toBe(fake.jobs().length);
  });

  it('waits on a person after round 2\'s changes, and never sends round 3 (PRD 2871)', async () => {
    const { fake, run, lines } = fleet();
    fake.status('running');
    await run();
    const PR = 'https://github.com/acme/widgets/pull/2817';
    for (const outcome of ['review', 'changes', 'review', 'changes'] as const) {
      fake.end(p(21), { status: 'done', outcome, prUrl: PR });
      await run();
    }
    const of21 = lines().filter((line) => / 21( |$)/.test(line));
    expect(of21).toEqual(['/omni:yolo 21 --for-review', '/omni:review 21', '/omni:yolo-fix 21 --for-review', '/omni:review 21']);
    expect(fake.mission().waitingOn).toContain('PRD 21: decide the Reviewer\'s findings on PR #2817');
    await run();
    await run();
    expect(lines().filter((line) => / 21( |$)/.test(line))).toEqual(of21);
    // The person takes it to ready: it waits for the merge.
    fake.set(p(21), { stage: 'ready' });
    await run();
    expect(fake.mission().waitingOn).toContain('PRD 21: merge it');
    expect(lines().filter((line) => / 21( |$)/.test(line))).toEqual(of21);
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
