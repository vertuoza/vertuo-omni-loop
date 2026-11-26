import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { reviewMarker } from 'omni-loop/kit/lib/review/verdict.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';

// Bug #3363: at Works alone the fleet answers its own questions (BR-PRODUCT-145, PRD omni-loop-21 s8). Mission #3319's build of
// omni-loop-28 built its 4 slices into the mission branch, then its gate ended red on one open high item of its page,
// `s1-02-parts-live-in-omni-ui`. After bug #3345 the mission waited for a person to answer it: the fleet's committee took a
// repository PRD's number only. A product PRD's high item now goes to the committee, which answers it for the mission branch only;
// once every item is carried or deferred its build goes again, and joins. Driven through the real job handler with the fake store.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d3363';
const NOW = Date.parse('2027-01-30T13:00:00Z');
const P28 = parseProductPrdId('omni-loop-28');
const ITEM = 's1-02-parts-live-in-omni-ui';
const BRANCH = 'mission/19-settings';
const HEAD = 'c'.repeat(40);
const BUILD = `/omni:ultra-yolo ${P28} --base-of demo-org/widgets=${BRANCH}`;
const ASK = `/omni:committee ${P28} --item ${ITEM} --bound 0.6`;

const record: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'demo-org/widgets',
  fleet: 'night-shift',
  number: parseIssue(19),
  title: 'Settings',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 1,
  scope: { prds: [], roadmaps: [] },
  ownPrds: 0,
  products: { prds: [P28], roadmaps: [] },
};

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

/** omni-loop-28's target pull request into the mission branch, as GitHub reads it: Ready, green, the Reviewer's pass on its head. */
const targetPull = (merged: boolean): PullRead => ({
  number: 3303,
  url: 'https://github.com/demo-org/widgets/pull/3303',
  title: 'Part of omni-loop-28',
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

/** omni-loop-28, approved, planned on demo-org/widgets, its page holding one open high item until a person answers it. */
const product: StoredProduct = {
  prd: P28,
  approval: 'standing',
  blockers: [],
  targets: ['demo-org/widgets'],
  items: { ranks: ['high'], open: [{ id: ITEM, rank: 'high' }] },
};

/** How omni-loop-28's build ended on mission #3319: its 4 slices built, its gate red on one open item. */
const RED = [
  '12:53:40 4 of 4 slices merged into feat/omni-loop-28: demo-org/widgets#3303.',
  '12:54:02 **Red gate:** 1 open item waits on omni-loop › Questions: parts live in @omni/ui as built (A), or @omni/design as the spec said.',
  '12:54:02 ',
  '12:54:02 /omni:ultra-yolo-fix omni-loop-28',
].join('\n');

/** The committee's answer record, as `omni committee record omni-loop-28 --item …` ends its job: every member yes, option A. */
const CARRIED = `13:10:00 omni committee: ${JSON.stringify({
  v: 1,
  prd: P28,
  author: null,
  read: [{ kind: 'item', sha256: 'a'.repeat(64) }],
  escalations: [],
  verdicts: [
    { role: 'pm', answer: 'yes', sentence: 'The parts are built in @omni/ui and work; moving them is cheap later.' },
    { role: 'architect', answer: 'yes', sentence: '@omni/ui is the package the pages already import.' },
    { role: 'reviewer', answer: 'yes', sentence: 'Nothing a user sees depends on the package name.' },
  ],
  outcome: 'carried',
  kind: 'answer',
  item: ITEM,
  option: 'A',
})}`;

async function builtRed() {
  const merged = new Set<number>();
  const joins: MissionJoins = {
    read: ({ pr }) => Promise.resolve(targetPull(merged.has(pr))),
    merge: ({ pr }) => {
      merged.add(pr);
      return Promise.resolve({ ok: true });
    },
    targets: () => Promise.resolve([{ repo: 'demo-org/widgets', pr: parsePr(3303) }]),
  };
  const fake = fakeMissionStore({ mission: record, facts: [], products: [product] });
  const run = () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  await run();
  expect(fake.productJobs().map(({ line }) => line)).toEqual([BUILD]);
  fake.endProduct(P28, { status: 'done', outcome: null }, RED);
  await run();
  return { fake, run };
}

describe('at Works alone, the fleet\'s committee answers a product PRD\'s high item (bug #3363)', () => {
  it('sends the committee for the open high item of a build that ended on its red gate, not a person', async () => {
    const { fake } = await builtRed();
    expect(fake.asks().map(({ line }) => line)).toEqual([ASK]);
    expect(fake.asks()[0]?.toFleet).toBe('night-shift');
    expect(fake.mission().waitingOn ?? '').not.toContain('answer them on its page');
    expect(fake.productJobs()).toHaveLength(1);
  });

  it('records the carried answer for the mission branch, builds it again, and joins it once Ready', async () => {
    const { fake, run } = await builtRed();
    fake.endAsk(ITEM, { status: 'done' }, CARRIED);
    await run();
    expect((await fake.store.decisions(ID)).map(({ prd, item, outcome }) => ({ prd, item, outcome }))).toEqual([{ prd: P28, item: ITEM, outcome: 'carried' }]);
    expect(fake.events().filter((one) => one.kind === 'decided').map((one) => one.sentence)).toEqual([expect.stringContaining(`The committee answered ${ITEM} of PRD omni-loop-28 with option A`)]);
    // The item stays open on its page for a person at landing (BR-PRODUCT-145): only the mission counts it answered.
    expect(fake.productJobs().map(({ line, key }) => [key, line])).toEqual([
      [`mission:${ID}:prd:${P28}:run:1`, BUILD],
      [`mission:${ID}:prd:${P28}:run:2`, BUILD],
    ]);
    fake.endProduct(P28, { status: 'done', outcome: 'ready' });
    await run();
    expect(fake.events().filter((one) => one.kind === 'prd-joined').map((one) => one.prd)).toEqual([P28]);
  });
});
