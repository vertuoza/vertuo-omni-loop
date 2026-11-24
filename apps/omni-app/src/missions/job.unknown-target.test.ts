// Bug #3275: one product PRD whose plan names a repository GitHub cannot find holds that PRD only, never the whole mission. The real
// job handler runs against the in-memory store and a fake GitHub whose mission branches refuse one repository; no database, no runner.
import { describe, expect, it } from 'vitest';
import { parseIssue, parseProductPrdId, parseProductRoadmapId } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';

const ID = '3b5d7f91-2c4e-4a6b-8d0f-1a3c5e7f9b2d';
const START = Date.parse('2027-02-03T09:00:00Z');
const BRANCH = 'mission/14-faster-quotes';
const P30 = parseProductPrdId('omni-loop-30');
const P31 = parseProductPrdId('omni-loop-31');

const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'demo-org/widgets',
  fleet: 'night-shift',
  number: parseIssue(14),
  title: 'Faster quotes',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  hardToRevert: 0.5,
  ownPrds: 0,
  scope: { prds: [], roadmaps: [] },
  products: { prds: [], roadmaps: [parseProductRoadmapId('omni-loop-R4')] },
};

const claimed = (): ClaimedJob => ({
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: mission.repo,
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(START + 5 * 60_000).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
});

/** Mission branches GitHub cuts in every repository but `missing`, which it does not find. */
function branchesWithout(missing: string): MissionBranches & { prepared: string[] } {
  const prepared: string[] = [];
  return {
    prepared,
    prepare: ({ repo }) => {
      prepared.push(repo);
      return Promise.resolve(repo === missing ? { ok: false, why: `${repo} is not found on GitHub, or the app is not installed on it: nothing was cut` } : { ok: true, cut: true });
    },
  };
}

describe('a product PRD whose plan names a repository GitHub cannot find (bug #3275)', () => {
  it('holds that PRD only, naming the repository, and builds the mission\'s other PRDs', async () => {
    // omni-loop-30's plan wrote the product's key, read as demo-org/omni-loop; omni-loop-31's names a repository GitHub has.
    const rows: StoredProduct[] = [
      { prd: P30, approval: 'standing', blockers: [], targets: ['demo-org/omni-loop'], items: { ranks: [], open: [] } },
      { prd: P31, approval: 'standing', blockers: [], targets: ['demo-org/api'], items: { ranks: [], open: [] } },
    ];
    const fake = fakeMissionStore({ mission, facts: [], products: rows });
    const branches = branchesWithout('demo-org/omni-loop');
    const handler = missionHandler({ store: fake.store, branches, joins: null, landings: null, answers: null, retests: null, galaxyUrl: 'https://omni.example.com', refresh: () => Promise.resolve('again'), now: () => START, log: () => undefined });

    await handler(claimed());

    expect(fake.productJobs().map((one) => one.line)).toEqual([`/omni:ultra-yolo omni-loop-31 --base-of demo-org/api=${BRANCH}`]);
    expect(fake.mission().waitingOn ?? '').toContain('demo-org/omni-loop is not found on GitHub');
    expect((await fake.store.branches(ID)).map((one) => one.repo)).not.toContain('demo-org/omni-loop');
  });
});
