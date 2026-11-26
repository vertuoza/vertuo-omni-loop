import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { reviewMarker } from 'omni-loop/kit/lib/review/verdict.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins, TargetPull } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';

// Bug #3345: a mission whose scope is a plain list of product PRDs (no roadmap, so no blocker the store reads) sent the builds of
// omni-loop-28, 30 and 31 at once. The builds of 30 and 31 stopped in a minute, building nothing, held on omni-loop-28, which had not
// joined the mission branch yet. An `/omni:ultra-yolo` job ends with no result word, so the mission read each hold as a build that
// stopped mid-way: it sent it again, then spent repairs on it, on its way to a person. A build held on a PRD of the scope now waits for
// that PRD to join, and is sent again, as a fresh run, once it has; one held on a PRD outside the scope that is not on the branch waits
// for a person, saying so. Driven through the real job handler with the fake store, on mission #3319's shape.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d3345';
const NOW = Date.parse('2027-01-30T09:00:00Z');
const P28 = parseProductPrdId('omni-loop-28');
const P30 = parseProductPrdId('omni-loop-30');
const P31 = parseProductPrdId('omni-loop-31');
const BRANCH = 'mission/19-settings';
const HEAD = 'b'.repeat(40);

const record = (): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'demo-org/widgets',
  fleet: 'night-shift',
  number: parseIssue(19),
  title: 'Settings',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 3,
  scope: { prds: [], roadmaps: [] },
  ownPrds: 0,
  products: { prds: [P28, P30, P31], roadmaps: [] },
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

const targetPull = (pr: number, merged: boolean): PullRead => ({
  number: pr,
  url: `https://github.com/demo-org/widgets/pull/${String(pr)}`,
  title: `Part of ${String(pr)}`,
  state: merged ? 'closed' : 'open',
  draft: false,
  merged,
  base: BRANCH,
  defaultBranch: 'main',
  head: HEAD,
  runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
  statuses: [],
  reviews: [{ body: `${reviewMarker(1, 'pass')}\n**Round 1 of 2: pass**`, commit: HEAD }],
  items: { ranks: [] },
});

/** A product PRD of the plain list, approved on its page, planned on demo-org/widgets: no blocker, as the store reads a list. */
const product = (prd: ProductPrdId): StoredProduct => ({ prd, approval: 'standing', blockers: [], targets: ['demo-org/widgets'], items: { ranks: [], open: [] } });

const BUILD = (prd: ProductPrdId): string => `/omni:ultra-yolo ${prd} --base-of demo-org/widgets=${BRANCH}`;

/** What the builds of omni-loop-30 and omni-loop-31 ended on, word for word as mission #3319's did (their page links shortened). */
const HELD_30 = [
  '12:16:48 **Held: PRD omni-loop-30 is blocked by omni-loop-28.** Nothing was cloned, branched, built or marked ready, and no outbox item was raised.',
  '12:16:48 ',
  `12:16:48 /omni:ultra-yolo omni-loop-30 --base-of demo-org/widgets=${BRANCH}`,
].join('\n');
const HELD_31 = [
  '12:17:57 Run PRD 28 first (and 27, which it builds on) so its parts land on the mission branch. Then run this again. It is safe to re-run.',
  '12:17:57 ',
  '12:17:57 Held: PRD omni-loop-31 waits on PRD omni-loop-28 and PRD omni-loop-27 · https://www.omni-loop.xyz/prd/31',
  '12:17:57 ',
  `12:17:57 \`/omni:ultra-yolo omni-loop-31 --base-of demo-org/widgets=${BRANCH}\``,
].join('\n');
const HELD_ON_27 = [
  '12:40:02 Held: PRD omni-loop-31 waits on PRD omni-loop-27 · https://www.omni-loop.xyz/prd/31',
  '12:40:02 ',
  `12:40:02 /omni:ultra-yolo omni-loop-31 --base-of demo-org/widgets=${BRANCH}`,
].join('\n');
const DONE_NO_WORD = { status: 'done', outcome: null } as const;

/** Mission #3319's shape: omni-loop-28, 30 and 31 of a plain list, their builds' run 1 sent at once. */
async function sentAtOnce() {
  const merged = new Set<string>();
  const targets: Record<string, TargetPull[]> = { [P28]: [{ repo: 'demo-org/widgets', pr: parsePr(28) }], [P30]: [{ repo: 'demo-org/widgets', pr: parsePr(30) }], [P31]: [{ repo: 'demo-org/widgets', pr: parsePr(31) }] };
  const joins: MissionJoins = {
    read: ({ repo, pr }) => Promise.resolve(targetPull(pr, merged.has(`${repo}#${String(pr)}`))),
    merge: ({ repo, pr }) => {
      merged.add(`${repo}#${String(pr)}`);
      return Promise.resolve({ ok: true });
    },
    targets: ({ prd }) => Promise.resolve(targets[prd] ?? []),
  };
  const fake = fakeMissionStore({ mission: record(), facts: [], products: [product(P28), product(P30), product(P31)] });
  const run = () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  await run();
  const builds = () => fake.productJobs().map(({ key }) => key);
  expect(fake.productJobs().map(({ line }) => line)).toEqual([BUILD(P28), BUILD(P30), BUILD(P31)]);
  return { fake, run, builds };
}

const key = (prd: ProductPrdId, run: number) => `mission:${ID}:prd:${prd}:run:${String(run)}`;

describe('a product build held on another PRD waits for it (bug #3345)', () => {
  it('sends nothing again for a build held on a PRD of the scope that has not joined, and spends no repair', async () => {
    const { fake, run, builds } = await sentAtOnce();
    fake.endProduct(P30, DONE_NO_WORD, HELD_30);
    fake.endProduct(P31, DONE_NO_WORD, HELD_31);
    await run();
    await run();
    expect(builds()).toEqual([key(P28, 1), key(P30, 1), key(P31, 1)]);
    expect(fake.repairJobs()).toEqual([]);
    expect(fake.mission().status).toBe('running');
    expect(fake.mission().waitingOn ?? '').toContain(`PRD omni-loop-30 waits for PRD omni-loop-28 to join ${BRANCH}`);
    expect(fake.mission().waitingOn ?? '').toContain(`PRD omni-loop-31 waits for PRD omni-loop-28 to join ${BRANCH}`);
    expect(fake.mission().waitingOn ?? '').not.toContain('take it to ready by hand');
  });

  it('sends the held builds again as their next run once the PRD they wait on joined', async () => {
    const { fake, run, builds } = await sentAtOnce();
    fake.endProduct(P30, DONE_NO_WORD, HELD_30);
    fake.endProduct(P31, DONE_NO_WORD, HELD_31);
    await run();
    expect(builds()).toEqual([key(P28, 1), key(P30, 1), key(P31, 1)]);
    fake.endProduct(P28, { status: 'done', outcome: 'ready' });
    await run();
    expect(fake.events().filter((one) => one.kind === 'prd-joined').map((one) => one.prd)).toEqual([P28]);
    expect(builds()).toEqual([key(P28, 1), key(P30, 1), key(P31, 1), key(P30, 2), key(P31, 2)]);
    expect(fake.productJobs().slice(3).map(({ line }) => line)).toEqual([BUILD(P30), BUILD(P31)]);
    expect(fake.repairJobs()).toEqual([]);
  });

  it('waits for a person when the build is held again on a PRD outside the scope that is not on the branch', async () => {
    const { fake, run, builds } = await sentAtOnce();
    fake.endProduct(P31, DONE_NO_WORD, HELD_31);
    fake.endProduct(P28, { status: 'done', outcome: 'ready' });
    await run();
    expect(builds()).toContain(key(P31, 2));
    fake.endProduct(P31, DONE_NO_WORD, HELD_ON_27);
    await run();
    expect(builds().filter((one) => one.includes(P31))).toEqual([key(P31, 1), key(P31, 2)]);
    expect(fake.repairJobs()).toEqual([]);
    expect(fake.mission().waitingOn ?? '').toContain('PRD omni-loop-31: its build waits on PRD omni-loop-27, outside the mission\'s scope and not on its branch');
  });

  it('waits for a PRD the spec says it is blocked by, when its build ended without naming it, then sends it once that PRD joined', async () => {
    const { fake, run, builds } = await sentAtOnce();
    // The store reads the spec's `blocked-by: [27, 28]`, omni-loop-27 being outside the scope; run 9 of mission #3319 named neither.
    fake.setProduct(P30, { blockers: [P28] });
    fake.endProduct(P30, DONE_NO_WORD, `12:19:24 Run it again once #3303 has joined the mission branch.\n12:19:24 /omni:ultra-yolo omni-loop-30`);
    await run();
    expect(builds()).toEqual([key(P28, 1), key(P30, 1), key(P31, 1)]);
    expect(fake.repairJobs()).toEqual([]);
    expect(fake.mission().waitingOn ?? '').toContain(`PRD omni-loop-30 waits for PRD omni-loop-28 to join ${BRANCH}`);
    fake.endProduct(P28, { status: 'done', outcome: 'ready' });
    await run();
    expect(builds()).toEqual([key(P28, 1), key(P30, 1), key(P31, 1), key(P30, 2)]);
  });

  it('a build that ended without its result line and names no PRD it waits on is sent again as before', async () => {
    const { fake, run, builds } = await sentAtOnce();
    fake.endProduct(P30, DONE_NO_WORD, '12:00:00 I stopped here.');
    await run();
    expect(builds()).toEqual([key(P28, 1), key(P30, 1), key(P31, 1), key(P30, 2)]);
  });
});
