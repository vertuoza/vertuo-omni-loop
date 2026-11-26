import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { fingerprint } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
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
const P29 = parseProductPrdId('omni-loop-29');
const P30 = parseProductPrdId('omni-loop-30');
const P31 = parseProductPrdId('omni-loop-31');
const BRANCH = 'mission/19-settings';
const HEAD = 'b'.repeat(40);

const record = (prds: ProductPrdId[], level: MissionRecord['level'] = 'alone'): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'demo-org/widgets',
  fleet: 'night-shift',
  number: parseIssue(19),
  title: 'Settings',
  level,
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

type Fake = ReturnType<typeof fakeMissionStore>;

/** Mission #3319's shape: omni-loop-28, 30 and 31 of a plain list (or `prds`), their builds' run 1 sent at once. */
async function sentAtOnce(prds: ProductPrdId[] = [P28, P30, P31], level: MissionRecord['level'] = 'alone') {
  const merged = new Set<string>();
  const targets: Record<string, TargetPull[]> = Object.fromEntries(prds.map((prd) => [prd, [{ repo: 'demo-org/widgets', pr: parsePr(Number(prd.slice(-2))) }]]));
  const joins: MissionJoins = {
    read: ({ repo, pr }) => Promise.resolve(targetPull(pr, merged.has(`${repo}#${String(pr)}`))),
    merge: ({ repo, pr }) => {
      merged.add(`${repo}#${String(pr)}`);
      return Promise.resolve({ ok: true });
    },
    targets: ({ prd }) => Promise.resolve(targets[prd] ?? []),
  };
  const fake = fakeMissionStore({ mission: record(prds, level), facts: [], products: prds.map(product) });
  const run = () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  await run();
  const builds = () => fake.productJobs().map(({ key }) => key);
  expect(fake.productJobs().map(({ line }) => line)).toEqual(prds.map(BUILD));
  return { fake, run, builds };
}

const key = (prd: ProductPrdId, run: number) => `mission:${ID}:prd:${prd}:run:${String(run)}`;

/** What `/omni:repair` ended on for a build of `prd` the mission took for a flake: a cause of its own per page. */
function flake(prd: ProductPrdId): string {
  const page = prd === P29 ? 'members' : prd === P30 ? 'business' : 'products';
  const cause = { class: 'flake' as const, place: `apps/galaxy/src/${page}/screen.tsx`, signature: `the ${page} page finds no settings parts` };
  const retro = { cause: 'The build found no settings parts.', ...cause, evidence: ['No SettingsSection in packages/design.'], proposedFix: 'Build it again.', fingerprint: fingerprint(cause) };
  return `12:30:00 ${repairRecordLine({ v: 1, mission: 19, prd, fingerprint: fingerprint(cause), class: 'flake', retro, fix: null, report: null })}`;
}

const queuedLast = (jobs: readonly { prd: unknown; attempts: readonly { status: string }[] }[], prd: ProductPrdId): boolean => jobs.filter((one) => one.prd === prd).at(-1)?.attempts.at(-1)?.status === 'queued';

/**
 * Mission #3319 before the fix: the builds of `held`, which named nothing they waited on, each ended without its result line, were
 * sent again past `mandate.resumes` and repaired as flakes, until the mission spent its 9 repairs.
 */
async function spendNine(fake: Fake, run: () => Promise<unknown>, held: readonly ProductPrdId[]): Promise<void> {
  for (let turn = 0; turn < 120 && !(fake.mission().waitingOn ?? '').includes('spent its 9 repairs'); turn += 1) {
    for (const prd of held) {
      if (queuedLast(fake.repairJobs(), prd)) fake.endRepairJob(prd, { status: 'done', outcome: 'ready' }, flake(prd));
      else if (queuedLast(fake.productJobs(), prd)) fake.endProduct(prd, DONE_NO_WORD, `12:19:24 Run it again once #3303 has joined the mission branch.\n12:19:24 /omni:ultra-yolo ${prd}`);
    }
    await run();
  }
}

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

  // Mission #3319 at 12:34 UTC: before the mission read omni-loop-30's spec, its held builds were taken for stops mid-way, resent past
  // `mandate.resumes` and repaired as flakes until the mission's 9 were spent. What is recorded alone gives them back.
  it('gives back the resumes and the 9 repairs spent on builds sent before their blocker joined, then repairs a real failure', async () => {
    const held = [P29, P30, P31];
    const { fake, run, builds } = await sentAtOnce([P28, ...held]);
    await spendNine(fake, run, held);
    expect(fake.repairRows()).toHaveLength(9);
    expect(fake.mission().waitingOn ?? '').toContain('the mission spent its 9 repairs; take it to ready by hand');

    // The fix deployed: the store reads each spec's `blocked-by`, and omni-loop-28 is still at work.
    for (const prd of held) fake.setProduct(prd, { blockers: [P28] });
    const sent = builds().length;
    await run();
    expect(builds()).toHaveLength(sent);
    expect(fake.repairJobs()).toHaveLength(9);
    for (const prd of held) expect(fake.mission().waitingOn ?? '').toContain(`PRD ${prd} waits for PRD omni-loop-28 to join ${BRANCH}`);
    expect(fake.mission().waitingOn ?? '').not.toContain('take it to ready by hand');

    // omni-loop-28 joins: each held build is sent again as its next run, none of the earlier ones counted.
    fake.endProduct(P28, { status: 'done', outcome: 'ready' });
    await run();
    expect(builds()).toHaveLength(sent + 3);
    for (const prd of held) expect(fake.productJobs().filter((one) => one.prd === prd).at(-1)?.key).toBe(key(prd, fake.productJobs().filter((one) => one.prd === prd).length));

    // A real failure of a build sent after omni-loop-28 joined gets a repair, the mission's 9 all there again.
    fake.endProduct(P30, { status: 'failed', outcome: null, reason: 'exit code 1' });
    await run();
    expect(fake.repairJobs()).toHaveLength(10);
    expect(fake.mission().waitingOn ?? '').toContain('PRD omni-loop-30: repairing (1 of 3) · 8 left in this mission');
  });

  // Mission #3319 at 12:54 UTC: omni-loop-28's build built its 4 slices, and its gate ended red on one open high item. Its last line,
  // `/omni:ultra-yolo-fix omni-loop-28`, was read as a build that ended without its result, and run 2 of the same build was sent.
  // Below `alone` a person answers it; at `alone` the fleet's committee does (bug #3363, ./job.product-committee.test.ts).
  it('a build that ended on its red gate waits for its open items, sends nothing again and spends no repair, then builds again once they are answered', async () => {
    const { fake, run, builds } = await sentAtOnce([P28, P30, P31], 'own-branch');
    const item = 's1-02-parts-live-in-omni-ui';
    fake.setProduct(P28, { items: { ranks: ['high'], open: [{ id: item, rank: 'high' }] } });
    const red = ['12:54:02 **Red gate:** 1 open item waits on omni-loop › Questions: parts live in @omni/ui as built (A), or @omni/design.', '12:54:02 ', '12:54:02 /omni:ultra-yolo-fix omni-loop-28'].join('\n');
    fake.endProduct(P28, DONE_NO_WORD, red);
    await run();
    await run();
    expect(builds().filter((one) => one.includes(P28))).toEqual([key(P28, 1)]);
    expect(fake.repairJobs()).toEqual([]);
    expect(fake.mission().waitingOn ?? '').toContain(`PRD omni-loop-28: its gate is red on 1 open item (${item}): answer them on its page, and the mission builds it again`);

    // A person answers it on the page: none is open, and the build goes again as its next run, its gate read again there.
    fake.setProduct(P28, { items: { ranks: [], open: [] } });
    await run();
    expect(builds().filter((one) => one.includes(P28))).toEqual([key(P28, 1), key(P28, 2)]);
    expect(fake.productJobs().filter((one) => one.prd === P28).at(-1)?.line).toBe(BUILD(P28));
  });
});

// Bug #3373, mission #3319 at 20:31 UTC: run 5 of omni-loop-28's build marked its target PR #3303 ready into the mission branch and
// ended on `/omni:mega-pr-care omni-loop-28`, the line /omni:ultra-yolo ends a build on once its target PRs read ready. The runner sets
// no result word for an ultra-yolo job, so the mission read the build as one that stopped mid-way and sent run 6.
describe('a product build that ended ready on its hand-off joins the mission branch (bug #3373)', () => {
  const READY_28 = [
    '20:31:02 **Ready:** #3303 into mission/19-settings, green, marked ready.',
    '20:31:02 Nothing is left held or stuck.',
    '20:31:02 ',
    '20:31:02 /omni:mega-pr-care omni-loop-28',
  ].join('\n');

  it('joins the build at the next run, its target PR merged into the mission branch, and sends no build again', async () => {
    const { fake, run, builds } = await sentAtOnce([P28]);
    fake.endProduct(P28, DONE_NO_WORD, READY_28);
    await run();
    expect(fake.events().filter((one) => one.kind === 'prd-joined').map((one) => one.prd)).toEqual([P28]);
    expect(builds()).toEqual([key(P28, 1)]);
    expect(fake.repairJobs()).toEqual([]);
  });

  it('joins it once a build sent again in the meantime ends the same way', async () => {
    const { fake, run, builds } = await sentAtOnce([P28]);
    fake.endProduct(P28, DONE_NO_WORD, '20:10:00 I stopped here.');
    await run();
    expect(builds()).toEqual([key(P28, 1), key(P28, 2)]);
    fake.endProduct(P28, DONE_NO_WORD, READY_28);
    await run();
    expect(fake.events().filter((one) => one.kind === 'prd-joined').map((one) => one.prd)).toEqual([P28]);
    expect(builds()).toEqual([key(P28, 1), key(P28, 2)]);
  });
});
