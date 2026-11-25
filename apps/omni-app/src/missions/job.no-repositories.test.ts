import { describe, expect, it } from 'vitest';
import { parseIssue, parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { planLine } from 'omni-loop/kit/lib/virtual-fleet/plan-record.ts';
import { pmLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import { techLine } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { Home } from './pm.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';

// Bug #3304: above `with-you`, a product PRD whose plan names no repository (no `## Repositories` table, so no targets) was sent
// `/omni:ultra-yolo <id>` with no `--base-of`, and its target feature pull request opened into the default branch. It is never built
// without bases: a PRD the PM wrote goes back to the PM's plan job, which writes the table, within the PM's rounds; then, or for a PRD
// a person wrote, it waits on a person, saying why.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e26';
const NOW = Date.parse('2027-01-30T09:00:00Z');
const P31 = parseProductPrdId('omni-loop-31');
const P40 = parseProductPrdId('omni-loop-40');
const A = 'a'.repeat(64);
const SERVER: Home = { phase0: 'server', product: 'omni-loop' };
const PLAN_JOB = '/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12';

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
  ownPrds: 2,
  ...over,
});

/** A product PRD's page whose plan names no repository. */
const page = (prd: ProductPrdId, over: Partial<StoredProduct> = {}): StoredProduct => ({
  prd,
  approval: 'none',
  blockers: [],
  targets: [],
  items: { ranks: [], open: [] },
  plan: null,
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

const wrote = (prds: ProductPrdId[]) => `12:00:00 Done\n${pmLine({ v: 1, mission: 12, skill: 'roadmap', cap: 2, prds, unwritten: [] })}`;
const approvedPlan = (plan: string) => `12:10:00 Done\n${planLine({ v: 1, prd: P31, plan, outcome: 'approved' })}`;
const reviewed = (plan: string) => `12:20:00 Done\n${techLine({ v: 1, prd: P31, plan, settled: [], open: [], outcome: 'approved' })}`;

function setup({ mission = record(), products = [] as StoredProduct[] } = {}) {
  const fake = fakeMissionStore({ mission, facts: [], products, productPages: [page(P31)], home: SERVER });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  const sentences = (kind: string) => fake.events().filter((event) => event.kind === kind).map((event) => event.sentence);
  return { fake, run, sentences };
}

/** The PM wrote omni-loop-31, planned it at version A with no Repositories table, and both the PM and the Architect approved A. */
async function approvedWithNoRepository() {
  const made = setup();
  await made.run();
  made.fake.endPm({ status: 'done', outcome: 'ready' }, wrote([P31]));
  await made.run();
  made.fake.setProduct(P31, { plan: A });
  made.fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(A));
  await made.run();
  made.fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(A));
  await made.run();
  return made;
}

describe('a product PRD whose plan names no repository, above with-you (bug #3304)', () => {
  it('is never built without --base-of: the PM is sent its plan job again to write the Repositories table', async () => {
    const { fake, sentences } = await approvedWithNoRepository();
    expect(fake.productJobs()).toEqual([]);
    expect(fake.pms().map(({ line }) => line).at(-1)).toBe(PLAN_JOB);
    expect(fake.pms()).toHaveLength(3);
    expect(sentences('dispatched').at(-1)).toContain('names no repository');
  });

  it('waits on a person, saying why, once the PM approved its plan again with still no repository', async () => {
    const { fake, run } = await approvedWithNoRepository();
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(A));
    await run();
    expect(fake.productJobs()).toEqual([]);
    expect(fake.pms()).toHaveLength(3);
    expect(fake.mission()).toMatchObject({ status: 'waiting' });
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-31: its plan names no repository');
  });

  it('a product PRD a person wrote and approved waits on a person instead of a build into the default branch', async () => {
    const { fake, run } = setup({ mission: record({ products: { prds: [P40], roadmaps: [] }, ownPrds: 0 }), products: [page(P40, { plan: A, approval: 'standing' })] });
    await run();
    expect(fake.productJobs()).toEqual([]);
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-40: its plan names no repository');
  });
});
