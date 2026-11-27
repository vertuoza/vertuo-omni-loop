import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins, TargetPull } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';

// Bug #3371: omni-loop-27 was built by an earlier mission into that mission's branch, and the mission's pull request then merged
// into the default branch. Mission #3319 was cut from the default branch after that, with omni-loop-28 and 29 in its scope and not 27.
// omni-loop-29's build (its spec blocked by 27) ended held on omni-loop-27, and the mission read 27 as outside its scope and not on
// its branch: it waited on a person, "merge it, or add it to the scope", for a PRD already on its branch. A PRD outside the scope
// whose merged work GitHub shows on the mission branch is no blocker: the held build is sent again as its next run. Driven through
// the real job handler with the fake store, on mission #3319's shape.

const ID = '7d2c4e91-5b3a-4f60-8e21-9a0b1c2d3371';
const NOW = Date.parse('2027-01-31T09:00:00Z');
const P27 = parseProductPrdId('omni-loop-27');
const P28 = parseProductPrdId('omni-loop-28');
const P29 = parseProductPrdId('omni-loop-29');
const BRANCH = 'mission/19-settings';
const HEAD = 'c'.repeat(40);

const record = (prds: ProductPrdId[]): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'demo-org/widgets',
  fleet: 'night-shift',
  number: parseIssue(19),
  title: 'Settings',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: prds.length,
  scope: { prds: [], roadmaps: [] },
  ownPrds: 0,
  products: { prds, roadmaps: [] },
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

const targetPull = (pr: number): PullRead => ({
  number: pr,
  url: `https://github.com/demo-org/widgets/pull/${String(pr)}`,
  title: `Part of ${String(pr)}`,
  state: 'open',
  draft: false,
  merged: false,
  base: BRANCH,
  defaultBranch: 'main',
  head: HEAD,
  runs: [],
  statuses: [],
  reviews: [],
  items: { ranks: [] },
});

const product = (prd: ProductPrdId): StoredProduct => ({ prd, approval: 'standing', blockers: [], targets: ['demo-org/widgets'], items: { ranks: [], open: [] } });

const BUILD = (prd: ProductPrdId): string => `/omni:ultra-yolo ${prd} --base-of demo-org/widgets=${BRANCH}`;

/** What omni-loop-29's build ended on, word for word as mission #3319's run 10 did (its page link shortened). */
const HELD_ON_27 = [
  "19:57:37 PRD 27 hasn't landed in the base. The plan says s1 and s5 build on what PRD 27 merges, so I'm holding the run.",
  '19:57:37 ',
  '19:57:37 held: PRD omni-loop-29 waits on PRD omni-loop-27 · https://www.omni-loop.xyz/prd/29',
  '19:57:37 ',
  `19:57:37 /omni:ultra-yolo omni-loop-29 --base-of demo-org/widgets=${BRANCH}`,
].join('\n');
const DONE_NO_WORD = { status: 'done', outcome: null } as const;

/** The joins GitHub answers, with whether each product PRD's merged work is on the mission branch (`landed`, bug #3371). */
type LandedJoins = MissionJoins & { landed: (at: { prd: ProductPrdId; branch: string }) => Promise<boolean> };

/** Mission #3319's shape: omni-loop-28 and 29 in scope, 27 not; `onBranch` the PRDs whose merged work is on the mission branch. */
async function mission(onBranch: readonly ProductPrdId[]) {
  const targets: Record<string, TargetPull[]> = { [P28]: [{ repo: 'demo-org/widgets', pr: parsePr(28) }], [P29]: [{ repo: 'demo-org/widgets', pr: parsePr(29) }] };
  const asked: string[] = [];
  const joins: LandedJoins = {
    read: ({ pr }) => Promise.resolve(targetPull(pr)),
    merge: () => Promise.resolve({ ok: true }),
    targets: ({ prd }) => Promise.resolve(targets[prd] ?? []),
    landed: ({ prd, branch }) => {
      asked.push(`${prd} on ${branch}`);
      return Promise.resolve(onBranch.includes(prd));
    },
  };
  const fake = fakeMissionStore({ mission: record([P28, P29]), facts: [], products: [P28, P29].map(product) });
  const run = () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  await run();
  expect(fake.productJobs().map(({ line }) => line)).toEqual([BUILD(P28), BUILD(P29)]);
  const builds = () => fake.productJobs().filter((one) => one.prd === P29).map(({ key }) => key);
  return { fake, run, builds, asked };
}

const key = (prd: ProductPrdId, run: number) => `mission:${ID}:prd:${prd}:run:${String(run)}`;

describe('a product build held on a PRD outside the scope that is on the mission branch (bug #3371)', () => {
  it('sends the build again as its next run, and asks no person, when the PRD it waits on is on the branch', async () => {
    const { fake, run, builds, asked } = await mission([P27]);
    fake.endProduct(P29, DONE_NO_WORD, HELD_ON_27);
    await run();
    expect(asked).toContain(`${P27} on ${BRANCH}`);
    expect(builds()).toEqual([key(P29, 1), key(P29, 2)]);
    expect(fake.productJobs().at(-1)?.line).toBe(BUILD(P29));
    expect(fake.repairJobs()).toEqual([]);
    expect(fake.mission().waitingOn ?? '').not.toContain('outside the mission\'s scope');
  });

  it('still waits for a person when the PRD outside the scope is not on the branch', async () => {
    const { fake, run, builds } = await mission([]);
    fake.endProduct(P29, DONE_NO_WORD, HELD_ON_27);
    await run();
    expect(builds()).toEqual([key(P29, 1)]);
    expect(fake.mission().waitingOn ?? '').toContain("PRD omni-loop-29: its build waits on PRD omni-loop-27, outside the mission's scope and not on its branch");
  });
});
