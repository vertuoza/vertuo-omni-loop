import { describe, expect, it } from 'vitest';
import { parseIssue, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { planLine } from 'omni-loop/kit/lib/virtual-fleet/plan-record.ts';
import { pmLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import { techLine } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { Attempt } from './supervisor.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { Home } from './pm.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';

// Bug #3287: a goal-only mission's product PRD whose build ended without its result line went straight to a person ("its job ended
// stopped; take it to ready by hand"). A build is a step: one that ends halfway gets a fresh job of the same skill, at most
// `mandate.resumes` times at `alone` (PRD omni-loop-21, spec section 5), and one held is sent again once, as a repository PRD's
// build is. A product PRD has no repair job yet, so past that a person takes it, saying why. Driven through the real job handler
// with the fake store, on the history PRD omni-loop-27 had on its mission: written by the PM, its plan approved by the PM and the
// Architect, its build sent once.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e27';
const NOW = Date.parse('2027-01-30T09:00:00Z');
const P27 = parseProductPrdId('omni-loop-27');
const PLAN = 'c'.repeat(64);
const SERVER: Home = { phase0: 'server', product: 'omni-loop' };
const BUILD = '/omni:ultra-yolo omni-loop-27 --base-of acme/widgets=mission/12-faster-quotes';

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 1,
  scope: { prds: [], roadmaps: [] },
  ownPrds: 1,
  ...over,
});

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

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

/** The mission run by the job handler, and what it sent of PRD omni-loop-27's build. */
function harness(fake: ReturnType<typeof fakeMissionStore>) {
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  const builds = () => fake.productJobs().map(({ key: one, line }) => [one, line]);
  /** The latest build ends as `change` says, and the mission runs once more. */
  const ends = async (change: Partial<Attempt>) => {
    fake.endProduct(P27, change);
    await run();
  };
  return { fake, run, builds, ends };
}

/** The goal-only mission of PRD omni-loop-27, run until its build's run 1 is sent: written by the PM, its plan approved by the PM, then by the Architect. */
async function built(mission = record()) {
  const made = harness(fakeMissionStore({ mission, facts: [], products: [], productPages: [{ prd: P27, approval: 'none', blockers: [], targets: ['acme/widgets'], items: { ranks: [], open: [] }, plan: null }], home: SERVER }));
  const { fake, run } = made;
  await run();
  fake.endPm({ status: 'done', outcome: 'ready' }, `12:00:00 Done\n${pmLine({ v: 1, mission: 12, skill: 'roadmap', cap: 1, prds: [P27], unwritten: [] })}`);
  await run();
  fake.setProduct(P27, { plan: PLAN });
  fake.endPm({ status: 'done', outcome: 'ready' }, `12:10:00 Done\n${planLine({ v: 1, prd: P27, plan: PLAN, outcome: 'approved' })}`);
  await run();
  fake.endTech(P27, { status: 'done', outcome: 'ready' }, `12:20:00 Done\n${techLine({ v: 1, prd: P27, plan: PLAN, settled: [], open: [], outcome: 'approved' })}`);
  await run();
  expect(made.builds()).toEqual([[`mission:${ID}:prd:omni-loop-27:run:1`, BUILD]]);
  return made;
}

/** A mission below alone whose scope names PRD omni-loop-27, approved on its page, run until its build's run 1 is sent. */
async function scoped() {
  const mission = record({ level: 'own-branch', ownPrds: 0, products: { prds: [P27], roadmaps: [] } });
  const made = harness(fakeMissionStore({ mission, facts: [], products: [{ prd: P27, approval: 'standing', blockers: [], targets: ['acme/widgets'], items: { ranks: [], open: [] } }] }));
  await made.run();
  expect(made.builds()).toEqual([[`mission:${ID}:prd:omni-loop-27:run:1`, BUILD]]);
  return made;
}

const key = (run: number) => `mission:${ID}:prd:omni-loop-27:run:${String(run)}`;
const HALFWAY: Partial<Attempt> = { status: 'done', outcome: null };

describe('a product PRD whose build ended without its result line (bug #3287)', () => {
  it('omni-loop-27: run 1 ended done with no result line, so run 2 of the same build is sent, and no person is asked', async () => {
    const { fake, builds, ends } = await built();
    await ends(HALFWAY);
    expect(builds()).toEqual([
      [key(1), BUILD],
      [key(2), BUILD],
    ]);
    expect(fake.mission().status).toBe('running');
    expect(fake.mission().waitingOn ?? '').not.toContain('take it to ready by hand');
  });

  it('at alone, a fresh build each time it ends halfway, up to mandate.resumes; past that a person takes it, saying why', async () => {
    const { fake, builds, ends } = await built(record({ resumes: 2 }));
    await ends(HALFWAY);
    await ends(HALFWAY);
    expect(builds().map(([one]) => one)).toEqual([key(1), key(2), key(3)]);
    await ends(HALFWAY);
    expect(builds().map(([one]) => one)).toEqual([key(1), key(2), key(3)]);
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-27: its build ended without its result line 3 times; take it to ready by hand and the mission joins it');
  });

  it('a build held is sent again once; held a second time, a person takes it', async () => {
    const { fake, builds, ends } = await built();
    await ends({ status: 'done', outcome: 'held' });
    expect(builds().map(([one]) => one)).toEqual([key(1), key(2)]);
    await ends({ status: 'done', outcome: 'held' });
    expect(builds().map(([one]) => one)).toEqual([key(1), key(2)]);
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-27: its build was held twice; take it to ready by hand and the mission joins it');
  });

  it('a build that stops on a question for a person, or fails, still goes to a person, and is not sent again', async () => {
    const asked = await built();
    await asked.ends({ status: 'done', outcome: 'human' });
    expect(asked.builds()).toHaveLength(1);
    expect(asked.fake.mission().waitingOn).toContain('PRD omni-loop-27: its job ended human; take it to ready by hand');
    const failed = await built();
    await failed.ends({ status: 'failed', outcome: null, reason: 'the runner crashed' });
    expect(failed.builds()).toHaveLength(1);
    expect(failed.fake.mission().waitingOn).toContain('PRD omni-loop-27: its job failed: the runner crashed; take it to ready by hand');
  });

  it('below alone, a build that ended halfway is sent again once, as a repository PRD\'s build is, then a person takes it', async () => {
    const { fake, builds, ends } = await scoped();
    await ends(HALFWAY);
    expect(builds().map(([one]) => one)).toEqual([key(1), key(2)]);
    await ends(HALFWAY);
    expect(builds().map(([one]) => one)).toEqual([key(1), key(2)]);
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-27: its build stopped mid-way twice; take it to ready by hand and the mission joins it');
  });
});
