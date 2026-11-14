// A fake fleet runs a mission to Delivered (PRD 2842 s9). The real supervisor and the real job handler run against the
// ledger's in-memory store and runner outcomes the test hands out: no database, no runner, no model call. The mission
// takes two roadmaps, as the store reads them (their rows expand through `expandScope`, blockers included), and a
// plan territory two of its PRDs share.
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
