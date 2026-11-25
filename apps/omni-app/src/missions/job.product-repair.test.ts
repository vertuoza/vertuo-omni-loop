import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { fingerprint, type RepairClass } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { Attempt } from './supervisor.ts';

// Bug #3302: a product PRD's build that failed, was held twice or spent its resumes went straight to a person, where a repository
// PRD's step gets a repair (BR-PRODUCT-139). A product PRD now gets the same repair, under the same caps (3 per cause in a round, 9 per
// mission, shared with the repository's PRDs): `/omni:repair --prd <key>-<n>`, its fix landing on the mission branch of the target
// repository it was opened in, then the build goes again. Once the repairs are spent, a person, with the reason; a build that stopped
// on a question for a person still goes to a person. Driven through the real job handler with the fake store.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e28';
const NOW = Date.parse('2027-01-30T09:00:00Z');
const P27 = parseProductPrdId('omni-loop-27');
const BRANCH = 'mission/12-faster-quotes';
const BUILD = `/omni:ultra-yolo omni-loop-27 --base-of acme/widgets=${BRANCH},acme/web=${BRANCH}`;

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'own-branch',
  status: 'running',
  waitingOn: null,
  parallel: 1,
  scope: { prds: [], roadmaps: [] },
  ownPrds: 0,
  products: { prds: [P27], roadmaps: [] },
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

const pull = (repo: string, number: number, over: Partial<PullRead> = {}): PullRead => ({
  number,
  url: `https://github.com/${repo}/pull/${String(number)}`,
  title: `fix: #${String(number)}`,
  state: 'open',
  draft: false,
  merged: false,
  base: BRANCH,
  defaultBranch: 'main',
  head: 'f'.repeat(40),
  runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
  statuses: [],
  reviews: [],
  items: { ranks: [] },
  ...over,
});

/** What `/omni:repair --prd omni-loop-27` ends on: a cause of `kind`, and for code its fix in `repo`. */
function repaired(kind: RepairClass, { fix = null, repo }: { fix?: number | null; repo?: string } = {}): string {
  const cause = { class: kind, place: 'apps/web/quote.ts', signature: 'AssertionError: expected 10.01 to be 10' };
  const print = fingerprint(cause);
  const retro = { cause: 'The quote total is not rounded.', ...cause, evidence: ['The test compares an unrounded total.'], proposedFix: 'Round the total before it is compared.', fingerprint: print };
  const line = repairRecordLine({ v: 1, mission: 12, prd: P27, fingerprint: print, class: kind, retro, fix: fix === null ? null : parsePr(fix), report: null, ...(repo === undefined ? {} : { repo }) });
  return `02:20:00 ${line}`;
}

/** The mission of PRD omni-loop-27, approved on its page and planned on acme/widgets and acme/web, run until its build's run 1 is sent. */
async function built() {
  const pulls = new Map<string, PullRead>();
  const merges: string[] = [];
  const joins: MissionJoins = {
    read: (at) => Promise.resolve({ ...(pulls.get(`${at.repo}#${String(at.pr)}`) ?? pull(at.repo, at.pr)) }),
    merge: (at) => {
      merges.push(`${at.repo}#${String(at.pr)}`);
      pulls.set(`${at.repo}#${String(at.pr)}`, pull(at.repo, at.pr, { merged: true, state: 'closed' }));
      return Promise.resolve({ ok: true });
    },
  };
  const fake = fakeMissionStore({ mission: record(), facts: [], products: [{ prd: P27, approval: 'standing', blockers: [], targets: ['acme/widgets', 'acme/web'], items: { ranks: [], open: [] } }] });
  const run = () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  await run();
  const builds = () => fake.productJobs().map(({ key }) => key);
  expect(fake.productJobs().map(({ line }) => line)).toEqual([BUILD]);
  /** The latest build ends as `change` says, and the mission runs once more. */
  const ends = async (change: Partial<Attempt>) => {
    fake.endProduct(P27, change);
    await run();
  };
  /** The latest repair ends done on `log`, and the mission runs once more. */
  const repairEnds = async (log: string) => {
    fake.endRepairJob(P27, { status: 'done', outcome: 'ready' }, log);
    await run();
  };
  return { fake, run, builds, ends, repairEnds, merges };
}

const key = (run: number) => `mission:${ID}:prd:omni-loop-27:run:${String(run)}`;
const repairKey = (k: number) => `mission:${ID}:prd:omni-loop-27:repair:${String(k)}`;
const FAILED: Partial<Attempt> = { status: 'failed', outcome: null, reason: 'exit code 1' };

describe('a product PRD whose build failed gets a repair (bug #3302, BR-PRODUCT-139)', () => {
  it('sends the repair, and once its cause was a flake the build goes again', async () => {
    const { fake, builds, ends, repairEnds } = await built();
    const failed = fake.productJobs()[0]?.job ?? '';
    await ends(FAILED);
    expect(fake.repairJobs().map(({ key: one, line }) => [one, line])).toEqual([[repairKey(1), `/omni:repair --mission 12 --prd omni-loop-27 --job ${failed}`]]);
    expect(checkRunnerLine(fake.repairJobs()[0]?.line ?? '')).toMatchObject({ ok: true, skill: 'repair' });
    expect(fake.mission().status).toBe('running');
    expect(fake.mission().waitingOn ?? '').toContain('PRD omni-loop-27: repairing (1 of 3) · 8 left in this mission');
    expect(fake.mission().waitingOn ?? '').not.toContain('take it to ready by hand');
    expect(builds()).toEqual([key(1)]);

    await repairEnds(repaired('flake'));
    expect(builds()).toEqual([key(1), key(2)]);
    expect(fake.repairRows().map(({ number, outcome }) => [number, outcome])).toEqual([[1, null]]);
    expect(fake.events().filter((event) => event.kind === 'repair-started').map((event) => [event.prd, event.sentence])).toEqual([
      [P27, expect.stringMatching(new RegExp(`^Sent /omni:repair --mission 12 --prd omni-loop-27 --job ${failed} to .+ \\(repair 1\\)\\.$`))],
    ]);

    // The build passes now: the repair ended fixed.
    await ends({ status: 'done', outcome: 'ready' });
    expect(fake.repairRows().map(({ outcome }) => outcome)).toEqual(['fixed']);
  });

  it('a code repair\'s fix in a target repository lands on that repository\'s mission branch, then the build goes again', async () => {
    const { fake, builds, ends, repairEnds, merges } = await built();
    await ends(FAILED);
    await repairEnds(repaired('code', { fix: 71, repo: 'acme/web' }));
    expect(merges).toEqual(['acme/web#71']);
    expect(fake.repairRows().map(({ fixPr }) => fixPr)).toEqual(['https://github.com/acme/web/pull/71']);
    expect(builds()).toEqual([key(1), key(2)]);
  });

  it('a fix in a repository the mission has no branch in never lands: the PRD goes to a person, saying why', async () => {
    const { fake, builds, ends, repairEnds, merges } = await built();
    await ends(FAILED);
    await repairEnds(repaired('code', { fix: 9, repo: 'acme/other' }));
    expect(merges).toEqual([]);
    expect(builds()).toEqual([key(1)]);
    expect(fake.mission().waitingOn ?? '').toContain('PRD omni-loop-27: its fix #9 cannot land on the mission branch');
  });

  it('a build held twice gets a repair instead of a person', async () => {
    const { fake, builds, ends } = await built();
    await ends({ status: 'done', outcome: 'held' });
    expect(builds()).toEqual([key(1), key(2)]);
    await ends({ status: 'done', outcome: 'held' });
    expect(fake.repairJobs().map(({ key: one }) => one)).toEqual([repairKey(1)]);
    expect(fake.mission().waitingOn ?? '').not.toContain('take it to ready by hand');
  });

  it('once a cause was repaired 3 times in the round, a person takes it, with the cause and what was tried', async () => {
    const { fake, builds, ends, repairEnds } = await built();
    for (let n = 1; n <= 3; n += 1) {
      await ends(FAILED);
      await repairEnds(repaired('flake'));
    }
    expect(builds()).toEqual([key(1), key(2), key(3), key(4)]);
    await ends(FAILED);
    await repairEnds(repaired('flake'));
    expect(builds()).toHaveLength(4);
    expect(fake.repairJobs()).toHaveLength(4);
    expect(fake.mission().status).toBe('waiting');
    expect(fake.mission().waitingOn ?? '').toContain('PRD omni-loop-27: its cause [');
    expect(fake.mission().waitingOn ?? '').toContain('was repaired 3 times');
  });

  it('a repair whose cause needs a person sends the PRD to a person with its question', async () => {
    const { fake, builds, ends, repairEnds } = await built();
    await ends(FAILED);
    await repairEnds(repaired('person'));
    expect(builds()).toEqual([key(1)]);
    expect(fake.mission().waitingOn ?? '').toContain('PRD omni-loop-27: its repair [');
    expect(fake.mission().waitingOn ?? '').toContain('needs a person');
  });

  it('a build that stopped on a question for a person still goes to a person, with no repair', async () => {
    const { fake, ends } = await built();
    await ends({ status: 'done', outcome: 'human' });
    expect(fake.repairJobs()).toEqual([]);
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-27: its job ended human; take it to ready by hand');
  });
});
