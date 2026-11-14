import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import type { ClaimedJob, Finish, JobLedger, RefreshJob } from '../jobs/ledger.ts';
import { runDue, type JobResult } from '../jobs/worker.ts';
import { LATERS_BEFORE_RENEW, MISSION_KIND, missionHandler, missionJob } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const MINUTE = 60_000;
const p = (n: number): PrdNumber => parsePrd(n);

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [p(1), p(2), p(3)], roadmaps: [parseIssue(40)] },
  ...over,
});
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });

/** The mission's job as the ledger hands it out. */
const claimed = (over: Partial<ClaimedJob> = {}): ClaimedJob => ({
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'acme/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(NOW + 5 * MINUTE).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
  ...over,
});

function setup({ mission = record(), all = [facts(1), facts(2), facts(3)], fleetRunners = true, planRepository = false }: { mission?: MissionRecord; all?: PrdFacts[]; fleetRunners?: boolean; planRepository?: boolean } = {}) {
  const fake = fakeMissionStore({ mission, facts: all, fleetRunners, planRepository });
  const refreshed: RefreshJob[] = [];
  const clock = { now: NOW };
  const handler = missionHandler({
    store: fake.store,
    refresh: (job) => {
      refreshed.push(job);
      return Promise.resolve('again');
    },
    now: () => clock.now,
    log: () => undefined,
  });
  const run = (over: Partial<ClaimedJob> = {}): Promise<JobResult> => handler(claimed(over));
  return { fake, refreshed, clock, run };
}

const later = (ms: number, laters: number): JobResult => ({ outcome: 'later', at: new Date(ms), progress: { laters } });

describe('the mission job: one per mission, in a lane of its own', () => {
  it('is keyed and laned by the mission, due at once, its payload the mission alone', () => {
    expect(missionJob(ID, 'Acme/Widgets')).toEqual({ kind: 'mission', key: `mission:${ID}`, subject: 'acme/widgets', payload: { mission: ID }, lane: `mission:${ID}`, delaySeconds: 0 });
  });
});

describe('a run of the mission (PRD 2842 s4)', () => {
  it('Start dispatches the startable PRDs at once, within the mandate, as the app, to the fleet\'s runners', async () => {
    const { fake, run } = setup();
    expect(await run()).toEqual(later(NOW + MINUTE, 1));
    expect(fake.jobs().map(({ line, key, toFleet, sentByApp }) => ({ line, key, toFleet, sentByApp }))).toEqual([
      { line: '/omni:yolo 1', key: `mission:${ID}:prd:1:run:1`, toFleet: 'night-shift', sentByApp: 'omni-app' },
      { line: '/omni:yolo 2', key: `mission:${ID}:prd:2:run:1`, toFleet: 'night-shift', sentByApp: 'omni-app' },
    ]);
    for (const job of fake.jobs()) expect(checkRunnerLine(job.line)).toMatchObject({ ok: true, skill: 'yolo' });
    expect(fake.events().map(({ kind, role, actor, sentence }) => [kind, role, actor, sentence])).toEqual([
      ['dispatched', 'supervisor', 'agent', 'Sent /omni:yolo 1 to the night-shift fleet\'s runners (run 1).'],
      ['dispatched', 'supervisor', 'agent', 'Sent /omni:yolo 2 to the night-shift fleet\'s runners (run 1).'],
    ]);
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: null, nextWakeAt: new Date(NOW + MINUTE).toISOString() });
  });

  it('sends /omni:ultra-yolo when the mission\'s repository is a product\'s plan repository, and says so', async () => {
    const { fake, run } = setup({ planRepository: true });
    await run();
    expect(fake.jobs().map((job) => job.line)).toEqual(['/omni:ultra-yolo 1', '/omni:ultra-yolo 2']);
    expect(fake.events()[0]?.sentence).toBe('Sent /omni:ultra-yolo 1 to the night-shift fleet\'s runners (run 1).');
  });

  it('sends /omni:yolo for any other repository', async () => {
    const { fake, run } = setup({ planRepository: false });
    await run();
    expect(fake.jobs().map((job) => job.line)).toEqual(['/omni:yolo 1', '/omni:yolo 2']);
  });

  it('sends to any runner of the workspace when no runner of the fleet holds the repository', async () => {
    const { fake, run } = setup({ fleetRunners: false });
    await run();
    expect(fake.jobs().map((job) => job.toFleet)).toEqual([null, null]);
    expect(fake.events()[0]?.sentence).toBe('Sent /omni:yolo 1 to any runner of the workspace (run 1).');
  });

  it('a replay inserts no second job and records nothing twice', async () => {
    const { fake, run } = setup();
    await run();
    await run({ progress: { laters: 1 } });
    expect(fake.jobs()).toHaveLength(2);
    expect(fake.events()).toHaveLength(2);
  });

  it('two runs at once insert one job per PRD, never two', async () => {
    const { fake, run } = setup();
    fake.together(2);
    await Promise.all([run(), run()]);
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:1:run:1`, `mission:${ID}:prd:2:run:1`]);
    expect(fake.events().filter((event) => event.kind === 'dispatched')).toHaveLength(2);
  });

  it('sends the next PRD once one ends, and waits for a person on a Ready', async () => {
    const { fake, run, clock } = setup();
    await run();
    fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/91' });
    clock.now = NOW + MINUTE;
    await run();
    expect(fake.jobs().map((job) => job.line)).toEqual(['/omni:yolo 1', '/omni:yolo 2', '/omni:yolo 3']);
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: 'PRD 1: merge it' });
    expect(fake.events().slice(2).map(({ kind, role, link }) => [kind, role, link])).toEqual([
      ['prd-ready', 'engineer', 'https://github.com/acme/widgets/pull/91'],
      ['dispatched', 'supervisor', null],
      ['waits', 'supervisor', null],
    ]);
  });

  it('a merge sends the PRDs it unblocks, and the mission reads Delivered only once every PRD is merged', async () => {
    const { fake, run } = setup({ mission: record({ scope: { prds: [p(1), p(2)], roadmaps: [] } }), all: [facts(1), facts(2, { blockers: [p(1)] })] });
    await run();
    expect(fake.jobs().map((job) => job.line)).toEqual(['/omni:yolo 1']);
    fake.end(p(1), { status: 'done', outcome: 'ready' });
    await run();
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 1: merge it' });
    fake.set(p(1), { stage: 'merged' });
    await run();
    expect(fake.jobs().map((job) => job.line)).toEqual(['/omni:yolo 1', '/omni:yolo 2']);
    fake.end(p(2), { status: 'done', outcome: 'ready' });
    fake.set(p(2), { stage: 'merged' });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.mission()).toMatchObject({ status: 'delivered', waitingOn: null, nextWakeAt: null });
    expect(fake.events().at(-1)).toMatchObject({ kind: 'delivered', sentence: 'Every PRD of the mission is merged: delivered.' });
  });

  it('sends a held PRD again once, then stops it, saying why', async () => {
    const { fake, run } = setup({ mission: record({ scope: { prds: [p(1)], roadmaps: [] } }), all: [facts(1)] });
    await run();
    fake.end(p(1), { status: 'done', outcome: 'held' });
    await run();
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:1:run:1`, `mission:${ID}:prd:1:run:2`]);
    fake.end(p(1), { status: 'done', outcome: 'held' });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.jobs()).toHaveLength(2);
    expect(fake.mission()).toMatchObject({ status: 'stopped', waitingOn: 'PRD 1 stopped: it was held twice. Take it to ready by hand and the mission carries on.' });
  });

  it('never sends a cancelled PRD again', async () => {
    const { fake, run } = setup({ mission: record({ scope: { prds: [p(1)], roadmaps: [] } }), all: [facts(1)] });
    await run();
    fake.end(p(1), { status: 'cancelled' });
    await run();
    await run();
    expect(fake.jobs()).toHaveLength(1);
    expect(fake.mission().status).toBe('stopped');
  });

  it('only records a lost runner: its resume carries it, and nothing is sent in its place', async () => {
    const { fake, run } = setup({ mission: record({ parallel: 1 }) });
    await run();
    fake.lose(p(1));
    await run();
    expect(fake.jobs()).toHaveLength(1);
    expect(fake.events().at(-1)).toMatchObject({ kind: 'job-ended', role: 'engineer', sentence: 'PRD 1\'s runner was lost: its resume carries the work on.' });
  });

  it('sends nothing while paused, records a running job\'s end, then rests once none runs', async () => {
    const { fake, run } = setup({ mission: record({ scope: { prds: [p(1), p(2), p(3)], roadmaps: [] } }) });
    await run();
    fake.status('paused');
    expect(await run()).toEqual(later(NOW + MINUTE, 1));
    fake.end(p(1), { status: 'done', outcome: 'ready' });
    fake.end(p(2), { status: 'done', outcome: 'answers' });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.jobs()).toHaveLength(2);
    expect(fake.mission()).toMatchObject({ status: 'paused', nextWakeAt: null });
    expect(fake.events().slice(2).map((event) => event.kind)).toEqual(['prd-ready', 'job-ended']);
  });

  it('re-reads a status changed while it ran, a minute on, and never overwrites it', async () => {
    const { fake, run } = setup();
    const update = fake.store.update;
    fake.store.update = (id, from, next) => {
      fake.status('paused');
      return update(id, from, next);
    };
    expect(await run()).toEqual(later(NOW + MINUTE, 1));
    expect(fake.mission().status).toBe('paused');
  });

  it('waits on a person when no PRD may start, naming what each waits on', async () => {
    const { fake, run } = setup({ all: [facts(1, { approval: 'none' }), facts(2, { approval: 'voided' }), facts(3, { blockers: [p(1)] })] });
    expect(await run()).toEqual(later(NOW + MINUTE, 1));
    expect(fake.jobs()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 1: approve it · PRD 2: approve it again' });
    fake.set(p(2), { approval: 'standing' });
    await run();
    expect(fake.jobs().map((job) => job.line)).toEqual(['/omni:yolo 2']);
  });

  it('refreshes its own job before the ledger\'s cap on laters, its count back to zero', async () => {
    const { refreshed, run } = setup();
    expect(await run({ progress: { laters: LATERS_BEFORE_RENEW - 2 } })).toEqual(later(NOW + MINUTE, LATERS_BEFORE_RENEW - 1));
    expect(refreshed).toEqual([]);
    expect(await run({ progress: { laters: LATERS_BEFORE_RENEW - 1 } })).toEqual(later(NOW + MINUTE, 0));
    expect(refreshed).toEqual([missionJob(ID, 'acme/widgets')]);
  });

  it('runs nothing for a draft, is done once delivered, and skips a mission it cannot read', async () => {
    expect(await setup({ mission: record({ status: 'draft' }) }).run()).toEqual({ outcome: 'skipped', reason: 'the mission is a draft: nothing runs before Start' });
    const delivered = setup({ mission: record({ status: 'delivered' }) });
    expect(await delivered.run()).toEqual({ outcome: 'done' });
    expect(delivered.fake.jobs()).toEqual([]);
    expect(await setup().run({ payload: { mission: 'ffffffff-ffff-4fff-8fff-ffffffffffff' } })).toEqual({ outcome: 'skipped', reason: 'no mission ffffffff-ffff-4fff-8fff-ffffffffffff' });
    const none = missionHandler({ store: null, refresh: () => Promise.resolve(), log: () => undefined });
    expect(await none(claimed())).toEqual({ outcome: 'skipped', reason: 'no database to read the mission from' });
  });

  it('refuses a malformed payload by its field', async () => {
    await expect(setup().run({ payload: { mission: 'not-a-uuid' } })).rejects.toThrow(/The mission job is malformed: mission:/);
  });
});

describe('on the ledger, through the worker', () => {
  it('a run ends `later`, a minute on, its try given back with its count of laters', async () => {
    const { fake } = setup();
    const queue = [claimed()];
    const finished: Finish[] = [];
    const ledger: JobLedger = {
      claim: (input) => Promise.resolve(queue.splice(0, input.limit)),
      finish: (input) => {
        finished.push(input);
        return Promise.resolve('queued');
      },
    };
    const handler = missionHandler({ store: fake.store, refresh: () => Promise.resolve(), now: () => NOW, log: () => undefined });
    const summary = await runDue({ ledger, handlers: { [MISSION_KIND]: handler }, clock: () => NOW, log: () => undefined });
    expect(summary).toMatchObject({ ran: 1, later: 1, failed: 0 });
    expect(finished).toEqual([{ id: 'bg-1', claim: 'claim-1', outcome: 'later', reason: null, retryAt: new Date(NOW + MINUTE).toISOString(), progress: { laters: 1 } }]);
    expect(fake.jobs()).toHaveLength(2);
  });
});
