// A fake fleet takes a goal alone to the builds of the product PRDs its PM wrote, on a repository whose phase 0 is on the server
// (PRD omni-loop-26 s6, AC-1, AC-3, AC-4, AC-6 end to end). The real job handler runs against the in-memory store, runner outcomes the
// test hands out, and the App's own GitHub pieces (./branch.ts, ./join.ts, ./landing.ts) over a fake GitHub of a real git repository
// (./git.fake.ts), which keeps every call. No database, no runner, no model call.
//
//   the PM writes    its roadmap job carries `--product omni-loop`; its record names two product PRDs, each added by the fleet
//   planned          the PM plans each (`/omni:mega-brainstorm --product omni-loop --plan-only <id>`) and its `omni plan:` approves
//                    plan version A; no committee job is ever sent for them
//   reviewed         the fleet's Architect reviews each (`/omni:tech-review <id> --mission 12`), edits its plan to version B and
//                    approves B, which gives the Tech Approval in the fleet's name; the PM is sent again and approves B
//   built            only then, `/omni:ultra-yolo <id>` into the mission branch, once both decisions name the latest version
//   nothing written  before the build, the repository holds no commit, no pull request and no branch but the empty mission branch
//                    the supervisor cuts at the mission's start (PRD 2896): no issue, inbox folder or phase-0 pull request of a PRD
//   no record        a third PRD whose Architect job leaves no `omni tech:` line is recorded escalated and waits on a person, never
//                    built, while the two others build
import { afterEach, describe, expect, it } from 'vitest';
import { parseIssue, parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { planLine } from 'omni-loop/kit/lib/virtual-fleet/plan-record.ts';
import { pmLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import { techLine } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import { missionBranches } from './branch.ts';
import { gitGithub } from './git.fake.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { missionJoins } from './join.ts';
import { missionLandings } from './landing.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';
import type { Attempt } from './supervisor.ts';

const ID = '5d2e8f1a-6b3c-4a7d-9e0f-1a2b3c4d5e26';
const START = Date.parse('2027-01-30T09:00:00Z');
const MINUTE = 60_000;
const BRANCH = 'mission/12-faster-quotes';
const P31 = parseProductPrdId('omni-loop-31');
const P32 = parseProductPrdId('omni-loop-32');
const P33 = parseProductPrdId('omni-loop-33');
/** A plan version of `prd`: the sha256 its page names, one per PRD and letter. */
const version = (prd: ProductPrdId, letter: 'a' | 'b'): string => `${letter}${prd.slice(-1)}`.repeat(32);

/** A goal-only mission at alone, three builds at once, started on a repository whose phase 0 is on the server, in product omni-loop. */
const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 3,
  scope: { prds: [], roadmaps: [] },
  ownPrds: 10,
};

/** The page of a product PRD the PM will write: no approval and no plan yet, its one repository the mission's. */
const page = (prd: ProductPrdId): StoredProduct => ({ prd, approval: 'none', blockers: [], targets: ['acme/widgets'], items: { ranks: [], open: [] }, plan: null });

const claimed = (): ClaimedJob => ({
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'acme/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(START + 5 * MINUTE).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
});

let opened: ReturnType<typeof gitGithub>[] = [];
afterEach(() => {
  for (const one of opened) one.done();
  opened = [];
});

/**
 * The mission's run, a minute after the last, over the fake store and the git repository. The PM's jobs are ended by their own line
 * (two plan jobs run at once), the rest as the fake store ends them.
 */
function fleetOf(written: readonly ProductPrdId[]) {
  const git = gitGithub();
  opened.push(git);
  const fake = fakeMissionStore({ mission, facts: [], products: [], productPages: written.map(page), home: { phase0: 'server', product: 'omni-loop' } });
  const endings = new Map<string, { change: Partial<Attempt>; log: string }>();
  const store = {
    ...fake.store,
    pmJobs: async (id: string) => (await fake.store.pmJobs(id)).map((job) => {
      const ended = endings.get(job.job);
      return ended === undefined ? job : { ...job, attempt: { ...job.attempt, ...ended.change } };
    }),
    committeeLog: async (job: string) => endings.get(job)?.log ?? (await fake.store.committeeLog(job)),
  };
  const octokitFor = () => git.octokit;
  const clock = { now: START };
  const handler = missionHandler({
    store,
    branches: missionBranches({ octokitFor }),
    joins: missionJoins({ octokitFor }),
    landings: missionLandings({ octokitFor }),
    refresh: () => Promise.resolve('again'),
    now: () => clock.now,
    log: () => undefined,
  });
  const run = async (): Promise<void> => {
    clock.now += MINUTE;
    await handler(claimed());
  };
  /** The PM's latest job whose line is `line` ends done, its log `log`. */
  const endPm = (line: string, log: string): void => {
    const job = fake.pms().filter((one) => one.line === line).at(-1);
    if (job === undefined) throw new Error(`no PM job ${line} was sent`);
    endings.set(job.job, { change: { status: 'done', outcome: 'ready' }, log });
  };
  const said = (kind: string): string[] => fake.events().filter((event) => event.kind === kind).map((event) => event.sentence);
  /** What the repository was written: every call that is not a read. */
  const writes = (): string[] => git.calls.filter(({ route }) => !route.startsWith('GET ')).map(({ route, params }) => `${route} ${JSON.stringify(params)}`);
  return { fake, git, run, endPm, said, writes };
}

const planOnly = (prd: ProductPrdId): string => `/omni:mega-brainstorm --product omni-loop --plan-only ${prd} --mission 12`;
const wrote = (prds: ProductPrdId[]): string => `12:00:00 Done\n${pmLine({ v: 1, mission: 12, skill: 'roadmap', cap: 10, prds, unwritten: [] })}`;
const approvedPlan = (prd: ProductPrdId, plan: string): string => `12:10:00 Done\n${planLine({ v: 1, prd, plan, outcome: 'approved' })}`;
const reviewed = (prd: ProductPrdId, plan: string, settled: string[]): string =>
  `12:20:00 Done\n${techLine({ v: 1, prd, plan, settled, open: [], outcome: 'approved' })}`;

describe('a goal-only mission whose PM writes product PRDs on Omni, reviewed by the Architect before the build (PRD omni-loop-26)', () => {
  it('AC-1, AC-3, AC-6: two PRDs written on the product, planned, approved by the PM, edited and approved by the Architect, approved again by the PM, then built', async () => {
    const { fake, git, run, endPm, said, writes } = fleetOf([P31, P32]);

    // AC-1: the PM's first job is the roadmap on the product, and a runner takes its line.
    await run();
    const roadmap = '/omni:roadmap --mission 12 --cap 10 --product omni-loop';
    expect(fake.pms().map(({ line, toFleet }) => [line, toFleet])).toEqual([[roadmap, 'night-shift']]);
    expect(checkRunnerLine(roadmap)).toMatchObject({ ok: true, skill: 'roadmap' });

    // Its record names two product PRDs: each is added by the fleet and planned by the PM, never sent to a committee.
    endPm(roadmap, wrote([P31, P32]));
    await run();
    expect(said('prd-added')).toEqual(['PRD omni-loop-31 added by the fleet.', 'PRD omni-loop-32 added by the fleet.']);
    expect(fake.pms().map(({ line }) => line)).toEqual([roadmap, planOnly(P31), planOnly(P32)]);
    expect(checkRunnerLine(planOnly(P31))).toMatchObject({ ok: true });

    // The PM pushes plan version A of each and approves it: a `plan` decision each; the Architect is sent its review of each.
    for (const prd of [P31, P32]) {
      fake.setProduct(prd, { plan: version(prd, 'a') });
      endPm(planOnly(prd), approvedPlan(prd, version(prd, 'a')));
    }
    await run();
    expect(fake.planDecisions().map(({ prd, kind, plan, outcome }) => [prd, kind, plan, outcome])).toEqual([
      [P31, 'plan', version(P31, 'a'), 'approved'],
      [P32, 'plan', version(P32, 'a'), 'approved'],
    ]);
    expect(said('job-ended')).toContain(`The PM approved the plan of PRD omni-loop-31 (version ${version(P31, 'a').slice(0, 7)}).`);
    expect(fake.techJobs().map(({ line, toFleet }) => [line, toFleet])).toEqual([
      ['/omni:tech-review omni-loop-31 --mission 12', 'night-shift'],
      ['/omni:tech-review omni-loop-32 --mission 12', 'night-shift'],
    ]);
    expect(checkRunnerLine('/omni:tech-review omni-loop-31 --mission 12')).toMatchObject({ ok: true });

    // The Architect edits each plan's coding parts into version B and approves B: the Tech Approval, in the fleet's name; no build yet,
    // since the PM approved A only. The PM is sent again on B.
    for (const prd of [P31, P32]) {
      fake.setProduct(prd, { plan: version(prd, 'b') });
      fake.endTech(prd, { status: 'done', outcome: 'ready' }, reviewed(prd, version(prd, 'b'), ['the slices s2 and s3 share no file now']));
    }
    await run();
    expect(fake.planDecisions().filter(({ kind }) => kind === 'tech').map(({ prd, plan, outcome, techApproval, approval }) => [prd, plan, outcome, techApproval, approval])).toEqual([
      [P31, version(P31, 'b'), 'approved', true, false],
      [P32, version(P32, 'b'), 'approved', true, false],
    ]);
    expect(said('job-ended')).toContain(`The Architect approved the plan of PRD omni-loop-31 (version ${version(P31, 'b').slice(0, 7)}), settling: the slices s2 and s3 share no file now.`);
    expect(fake.pms().map(({ line }) => line)).toEqual([roadmap, planOnly(P31), planOnly(P32), planOnly(P31), planOnly(P32)]);
    expect(said('dispatched')).toContain(`Sent the PM ${planOnly(P32)} again: PRD omni-loop-32 has a newer plan version, so the PM approves it.`);
    expect(fake.productJobs()).toEqual([]);

    // Nothing is written to the repository before the build: no commit, no pull request, no branch but the empty mission branch.
    expect(writes()).toEqual([`POST /repos/{owner}/{repo}/git/refs ${JSON.stringify({ owner: 'acme', repo: 'widgets', ref: `refs/heads/${BRANCH}`, sha: git.head('main') })}`]);
    expect(git.branches().sort()).toEqual(['main', BRANCH].sort());
    expect(git.head(BRANCH)).toBe(git.head('main'));
    expect(git.pullOf(1)).toBeUndefined();

    // The PM approves B: both decisions name the latest version, the PRD is approved for the fleet, and each is built.
    for (const prd of [P31, P32]) endPm(planOnly(prd), approvedPlan(prd, version(prd, 'b')));
    await run();
    expect(fake.planDecisions().filter(({ kind }) => kind === 'plan').map(({ prd, plan, approval }) => [prd, plan?.slice(0, 2), approval])).toEqual([
      [P31, 'a1', false],
      [P32, 'a2', false],
      [P31, 'b1', true],
      [P32, 'b2', true],
    ]);
    expect(fake.productJobs().map(({ line, toFleet }) => [line, toFleet])).toEqual([
      [`/omni:ultra-yolo omni-loop-31 --base-of acme/widgets=${BRANCH}`, 'night-shift'],
      [`/omni:ultra-yolo omni-loop-32 --base-of acme/widgets=${BRANCH}`, 'night-shift'],
    ]);

    // Four PM jobs after the roadmap, two reviews, two builds, and never a committee; the mission runs while they build.
    expect(fake.techJobs()).toHaveLength(2);
    expect(fake.committees()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: null });
  });

  it('AC-4: a third PRD whose Architect jobs left no record twice is escalated and waits on a person, while the two others are built', async () => {
    const { fake, run, endPm, said, writes } = fleetOf([P31, P32, P33]);
    const roadmap = '/omni:roadmap --mission 12 --cap 10 --product omni-loop';
    await run();
    endPm(roadmap, wrote([P31, P32, P33]));
    await run();
    expect(fake.pms().map(({ line }) => line)).toEqual([roadmap, planOnly(P31), planOnly(P32), planOnly(P33)]);

    // The PM plans and approves version A of each; the Architect approves A of the first two, and its job for the third ends with
    // its record line cut.
    for (const prd of [P31, P32, P33]) {
      fake.setProduct(prd, { plan: version(prd, 'a') });
      endPm(planOnly(prd), approvedPlan(prd, version(prd, 'a')));
    }
    await run();
    expect(fake.techJobs()).toHaveLength(3);
    for (const prd of [P31, P32]) fake.endTech(prd, { status: 'done', outcome: 'ready' }, reviewed(prd, version(prd, 'a'), []));
    fake.endTech(P33, { status: 'done', outcome: 'ready' }, '12:20:00 Done\nomni tech: {"v":1,"prd":"omni-loop-33","pl');
    await run();

    // The third is recorded escalated, never approved (BL-GATE-1); the two others are built.
    expect(fake.planDecisions().filter(({ prd }) => prd === P33).map(({ kind, plan, outcome, why, techApproval }) => [kind, plan, outcome, why, techApproval])).toEqual([
      ['plan', version(P33, 'a'), 'approved', [], false],
      ['tech', null, 'escalated', ['no record of the tech review'], false],
    ]);
    expect(said('job-ended')).toContain('The Architect left PRD omni-loop-33 to a person: no record of the tech review.');
    expect(fake.productJobs().map(({ line }) => line)).toEqual([
      `/omni:ultra-yolo omni-loop-31 --base-of acme/widgets=${BRANCH}`,
      `/omni:ultra-yolo omni-loop-32 --base-of acme/widgets=${BRANCH}`,
    ]);

    // A job that left no record decided nothing (bug #3281): the Architect is sent again, once; its second job left none either, so
    // the PM approves the latest version again, once (bug #3326), and the Architect gets two more reviews; those left none either,
    // so the PRD waits on a person, with no build.
    await run();
    expect(fake.techJobs()).toHaveLength(4);
    fake.endTech(P33, { status: 'failed', outcome: null });
    await run();
    expect(fake.pms()).toHaveLength(5);
    endPm(planOnly(P33), approvedPlan(P33, version(P33, 'a')));
    await run();
    expect(fake.techJobs()).toHaveLength(5);
    fake.endTech(P33, { status: 'failed', outcome: null });
    await run();
    await run();
    expect(fake.techJobs()).toHaveLength(6);
    fake.endTech(P33, { status: 'failed', outcome: null });
    await run();
    await run();
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-33: the Architect left it to you: no record of the tech review');

    // It stays so: no more review, no build, no PM job, nothing more written, until a person approves it on its page.
    const sent = writes().length;
    await run();
    expect(fake.techJobs()).toHaveLength(6);
    expect(fake.productJobs()).toHaveLength(2);
    expect(fake.pms()).toHaveLength(5);
    expect(fake.committees()).toEqual([]);
    expect(writes()).toHaveLength(sent);
    fake.setProduct(P33, { approval: 'standing' });
    await run();
    expect(fake.productJobs().map(({ line }) => line).at(-1)).toBe(`/omni:ultra-yolo omni-loop-33 --base-of acme/widgets=${BRANCH}`);
  });
});
