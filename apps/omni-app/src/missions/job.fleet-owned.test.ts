import { describe, expect, it } from 'vitest';
import { parseIssue, parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { planLine } from 'omni-loop/kit/lib/virtual-fleet/plan-record.ts';
import { techLine } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { Home } from './pm.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';

// Bug #3324 (mission #3319): at `alone`, a product PRD of the mission's scope that its own PM did not write (an earlier mission's PM
// wrote it, or a person did) was read as a person's: a plan with no `## Repositories` table, or with no approval, waited on a person.
// The owner decided that at `alone` every product PRD of the scope is the fleet's to plan and approve, whoever wrote it, as a PRD its
// own PM wrote (PRD omni-loop-26): the PM's plan job, the Architect's review, the fleet's approval, then the build. Below `alone`,
// nothing changes.

const ID = '5d0e2a7c-81f4-4b39-a6c2-9e3f1b7d4a10';
const NOW = Date.parse('2027-01-30T09:00:00Z');
const P28 = parseProductPrdId('demo-28');
const P29 = parseProductPrdId('demo-29');
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const SERVER: Home = { phase0: 'server', product: 'demo' };
const BRANCH = 'mission/19-ship-the-demo';

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'demo-org/widgets',
  fleet: 'invincibles',
  number: parseIssue(19),
  title: 'Ship the demo',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [], roadmaps: [] },
  ownPrds: 0,
  ...over,
});

/** A product PRD's page with a plan at version A: no Repositories table (no targets) unless given. */
const page = (prd: ProductPrdId, over: Partial<StoredProduct> = {}): StoredProduct => ({
  prd,
  approval: 'none',
  blockers: [],
  targets: [],
  items: { ranks: [], open: [] },
  plan: A,
  ...over,
});

const claimed: ClaimedJob = {
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'demo-org/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(NOW + 300_000).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
};

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

const planJob = (prd: ProductPrdId) => `/omni:mega-brainstorm --product demo --plan-only ${prd} --mission 19`;
const approvedPlan = (prd: ProductPrdId, plan: string) => `12:10:00 Done\n${planLine({ v: 1, prd, plan, outcome: 'approved' })}`;
const reviewed = (prd: ProductPrdId, plan: string) => `12:20:00 Done\n${techLine({ v: 1, prd, plan, settled: [], open: [], outcome: 'approved' })}`;

/** A mission whose scope names `products`, none of which its PM wrote. */
function setup(products: StoredProduct[], over: Partial<MissionRecord> = {}) {
  const fake = fakeMissionStore({ mission: record({ products: { prds: products.map((one) => one.prd), roadmaps: [] }, ...over }), facts: [], products, home: SERVER });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run };
}

describe('at alone, a scope product PRD the mission\'s PM did not write is the fleet\'s to plan and approve (bug #3324)', () => {
  it('a plan with no Repositories table goes to the PM\'s plan job, not to a person', async () => {
    const { fake, run } = setup([page(P28)]);
    await run();
    expect(fake.pms().map(({ line }) => line)).toEqual([planJob(P28)]);
    expect(fake.productJobs()).toEqual([]);
    expect(fake.mission().waitingOn ?? '').not.toContain('its plan names no repository');
    expect(fake.mission().status).toBe('running');
  });

  it('a plan with a table and no approval: the PM\'s plan job, the Architect\'s review, the fleet\'s approval, then the build into the mission branch', async () => {
    const { fake, run } = setup([page(P29, { targets: ['demo-org/widgets'] })]);
    await run();
    expect(fake.pms().map(({ line }) => line)).toEqual([planJob(P29)]);
    expect(fake.mission().waitingOn ?? '').not.toContain('approve it on its page');
    fake.setProduct(P29, { plan: B });
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(P29, B));
    await run();
    expect(fake.techJobs().map(({ line }) => line)).toEqual([`/omni:tech-review ${P29} --mission 19`]);
    fake.endTech(P29, { status: 'done', outcome: 'ready' }, reviewed(P29, B));
    await run();
    expect(fake.productJobs().map(({ line }) => line)).toEqual([`/omni:ultra-yolo ${P29} --base-of demo-org/widgets=${BRANCH}`]);
  });

  it('a PRD another mission approved on the same plan: this mission\'s PM and Architect approving it give the build, not a person (bug #3336)', async () => {
    // Mission #3319 on omni-loop-31: the stopped #3270's approval of the latest plan reads as none here (BR-PRODUCT-144), and the
    // pair of this mission's decisions on that plan gives this mission its own (mission_decide_plan(), as the fake decides it).
    const { fake, run } = setup([page(P29, { targets: ['demo-org/widgets'], plan: B })]);
    await run();
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(P29, B));
    await run();
    fake.endTech(P29, { status: 'done', outcome: 'ready' }, reviewed(P29, B));
    await run();
    expect(fake.planDecisions().map(({ kind, plan, approval }) => [kind, plan, approval])).toEqual([['plan', B, false], ['tech', B, true]]);
    expect(fake.productJobs().map(({ line }) => line)).toEqual([`/omni:ultra-yolo ${P29} --base-of demo-org/widgets=${BRANCH}`]);
    expect(fake.mission().waitingOn ?? '').not.toContain('approve it on its page');
  });

  it('a PRD that already holds a standing approval and a plan with its table is built as before, with no new plan', async () => {
    const { fake, run } = setup([page(P29, { targets: ['demo-org/widgets'], approval: 'standing' })]);
    await run();
    expect(fake.pms()).toEqual([]);
    expect(fake.productJobs().map(({ line }) => line)).toEqual([`/omni:ultra-yolo ${P29} --base-of demo-org/widgets=${BRANCH}`]);
  });

  it('the PM\'s plan job tells the truth: it plans a PRD of the scope, not one it wrote', async () => {
    const { fake, run } = setup([page(P28)]);
    await run();
    const sent = fake.events().filter((event) => event.kind === 'dispatched').map((event) => event.sentence);
    expect(sent.join(' ')).not.toContain('which it wrote');
    expect(sent.join(' ')).toContain(`it plans PRD ${P28} of the mission's scope`);
  });
});

describe('below alone, a scope product PRD waits on a person as before (bug #3324)', () => {
  it('at own-branch, a plan with a table and no approval waits for its approval, and no PM job is sent', async () => {
    const { fake, run } = setup([page(P29, { targets: ['demo-org/widgets'] })], { level: 'own-branch' });
    await run();
    expect(fake.pms()).toEqual([]);
    expect(fake.techJobs()).toEqual([]);
    expect(fake.mission().waitingOn).toContain(`PRD ${P29}: approve it on its page`);
  });

  it('at own-branch, a plan with no table and a standing approval waits on a person to write it', async () => {
    const { fake, run } = setup([page(P28, { approval: 'standing' })], { level: 'own-branch' });
    await run();
    expect(fake.pms()).toEqual([]);
    expect(fake.mission().waitingOn).toContain(`PRD ${P28}: its plan names no repository`);
  });
});
