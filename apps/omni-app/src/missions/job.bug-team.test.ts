// The Omni Loop bug team's run (PRD 3088 s3, AC-1 to AC-4 and AC-9), through the fake store and a fake read of the issues: no
// database, no GitHub, no clock.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, type IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { JobResult } from '../jobs/worker.ts';
import type { Bug, IssueRead } from './bug-team.ts';
import type { BugIssuesAt, MissionBugIssues } from './bug-team.github.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';

const ID = '5d2a9c40-7e1b-4f36-8a20-9b3c1d4e5f60';
const REPO = 'vertuoza/vertuo-omni-loop';
const NOW = Date.parse('2027-01-27T09:00:00Z');
const MINUTE = 60_000;

const team = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-omni',
  repo: REPO,
  fleet: 'bug-squad',
  number: parseIssue(40),
  title: 'Fix the Omni Loop bugs missions report',
  level: 'with-you',
  status: 'running',
  waitingOn: null,
  parallel: 1,
  scope: { prds: [], roadmaps: [] },
  kind: 'omni-bugs',
  ...over,
});

const bug = (issue: number, over: Partial<Bug> = {}): Bug => ({
  fingerprint: String(issue).padStart(64, 'b'),
  issue: parseIssue(issue),
  count: 1,
  createdAt: '2027-01-20T09:00:00Z',
  state: 'open',
  attempts: 0,
  fixPr: null,
  fixedIn: null,
  askedJob: null,
  ...over,
});

const claimed: ClaimedJob = {
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: REPO,
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(NOW + 5 * MINUTE).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
};

/** GitHub's issues as the fake reads them: open with no fix by default, `reads` overriding; each read kept. */
function fakeIssues(reads: Map<number, IssueRead> = new Map()) {
  const asked: BugIssuesAt[] = [];
  const port: MissionBugIssues = {
    read: (at) => {
      asked.push(at);
      return Promise.resolve(new Map(at.issues.map((issue): [IssueNumber, IssueRead] => [issue, reads.get(issue) ?? { open: true, openFix: null }])));
    },
  };
  return { port, asked };
}

function setup({ mission = team(), bugs, reads, issues = true }: { mission?: MissionRecord; bugs: Bug[]; reads?: Map<number, IssueRead>; issues?: boolean }) {
  const clock = { now: NOW };
  const fake = fakeMissionStore({ mission, facts: [], now: () => clock.now, team: { bugs } });
  const github = fakeIssues(reads);
  const handler = missionHandler({ store: fake.store, bugIssues: issues ? github.port : null, refresh: () => Promise.resolve('again'), now: () => clock.now, log: () => undefined });
  const run = (): Promise<JobResult> => handler(claimed);
  const stateOf = (issue: number) => fake.bugs().find((one) => one.issue === issue);
  const kinds = () => fake.events().map((event) => event.kind);
  return { fake, clock, run, stateOf, kinds, github };
}

describe('the Omni Loop bug team takes the most-reported bug first', () => {
  it('AC-1: sends one job /omni:bug-fix for the bug counted 7, keyed by its issue, and that bug reads fixing', async () => {
    const { fake, run, stateOf, kinds } = setup({ bugs: [bug(3101, { count: 2 }), bug(3102, { count: 7 })] });
    expect(await run()).toEqual({ outcome: 'later', at: new Date(NOW + MINUTE), progress: { laters: 1 } });
    expect(fake.bugJobs()).toEqual([expect.objectContaining({ issue: 3102, k: 1, line: '/omni:bug-fix #3102', key: `mission:${ID}:bug:3102:run:1`, toFleet: 'bug-squad' })]);
    expect(stateOf(3102)?.state).toBe('fixing');
    expect(stateOf(3101)?.state).toBe('open');
    expect(kinds()).toEqual(['bug-taken']);
    expect(fake.events()[0]).toMatchObject({ role: 'supervisor', actor: 'agent', prd: null, link: `https://github.com/${REPO}/issues/3102`, sentence: 'Took Omni Loop bug #3102 (reported 7×): sent /omni:bug-fix #3102, try 1 of 3.' });
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: null });
  });

  it('takes the next bug once the first one\'s fix pull request is open, and sends nothing twice on a replay', async () => {
    const { fake, run, stateOf } = setup({ bugs: [bug(3101, { count: 2 }), bug(3102, { count: 7 })] });
    await run();
    await run();
    expect(fake.bugJobs()).toHaveLength(1);
    fake.endBug(3102, { status: 'done', outcome: 'pr-opened', prUrl: `https://github.com/${REPO}/pull/3200` });
    await run();
    expect(stateOf(3102)).toMatchObject({ state: 'pr-opened', fixPr: 3200 });
    expect(fake.bugJobs().map((one) => one.line)).toEqual(['/omni:bug-fix #3102', '/omni:bug-fix #3101']);
  });
});

describe('a bug a person is on', () => {
  it('AC-2: sends no job for a bug whose issue already has an open pull request that closes it', async () => {
    const reads = new Map([[3102, { open: true, openFix: parsePr(3150) }]]);
    const { fake, run, stateOf } = setup({ bugs: [bug(3102, { count: 7 })], reads });
    await run();
    expect(fake.bugJobs()).toEqual([]);
    expect(stateOf(3102)?.state).toBe('open');
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: null });
  });

  it('skips a closed issue too, and takes the next bug', async () => {
    const reads = new Map([[3102, { open: false, openFix: null }]]);
    const { fake, run } = setup({ bugs: [bug(3102, { count: 7 }), bug(3101, { count: 2 })], reads });
    await run();
    expect(fake.bugJobs().map((one) => one.issue)).toEqual([3101]);
  });
});

describe('a bug the team cannot fix alone', () => {
  it('AC-3: sets the bug aside as asked once, takes another at the next wake, and never asks about it again', async () => {
    const { fake, run, stateOf, kinds, clock } = setup({ bugs: [bug(3102, { count: 7 }), bug(3101, { count: 2 })] });
    await run();
    fake.endBug(3102, { status: 'done', outcome: 'human' });
    const asked = fake.bugJobs()[0]?.job;
    await run();
    expect(stateOf(3102)).toMatchObject({ state: 'asked', askedJob: asked });
    expect(fake.bugJobs().map((one) => one.issue)).toEqual([3102, 3101]);
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: 'Omni Loop bug #3102: answer its question' });
    for (let wake = 0; wake < 3; wake += 1) {
      clock.now += MINUTE;
      await run();
    }
    expect(kinds().filter((kind) => kind === 'bug-asked')).toHaveLength(1);
    expect(fake.bugJobs().filter((one) => one.issue === 3102)).toHaveLength(1);
    expect(fake.events().find((event) => event.kind === 'bug-asked')).toMatchObject({ job: asked, sentence: 'Omni Loop bug #3102 (reported 7×) is set aside: its bug fix needs a person, and its question waits for a person.' });
  });
});

describe('three tries with no pull request', () => {
  it('AC-4: sets the bug aside as asked with what was tried after its third stuck job, and never counts a fourth', async () => {
    const { fake, run, stateOf, kinds } = setup({ bugs: [bug(3102, { count: 7 })] });
    for (const k of [1, 2, 3]) {
      await run();
      expect(fake.bugJobs()).toHaveLength(k);
      fake.endBug(3102, { status: 'done', outcome: 'stuck' });
    }
    await run();
    expect(stateOf(3102)).toMatchObject({ state: 'asked', attempts: 3 });
    expect(fake.bugJobs()).toHaveLength(3);
    expect(fake.events().filter((event) => event.kind === 'bug-asked').map((event) => event.sentence)).toEqual(['Omni Loop bug #3102 (reported 7×) is set aside after 3 tries (stuck, stuck, stuck): it waits for a person.']);
    expect(kinds()).toEqual(['bug-taken', 'job-ended', 'bug-taken', 'job-ended', 'bug-taken', 'bug-asked']);
    // A person sends it back with its 3 tries spent: its next failure sets it aside again, and its tries stay at 3.
    fake.setBug(3102, { state: 'open' });
    await run();
    fake.endBug(3102, { status: 'done', outcome: 'blocked' });
    await run();
    expect(stateOf(3102)).toMatchObject({ state: 'asked', attempts: 3 });
  });

  it('spends no try on a lost runner: the resume carries the job, and its end counts once', async () => {
    const { fake, run, stateOf } = setup({ bugs: [bug(3102)] });
    await run();
    fake.loseBug(3102);
    await run();
    expect(stateOf(3102)).toMatchObject({ state: 'fixing', attempts: 0 });
    expect(fake.bugJobs()).toHaveLength(1);
    fake.endBug(3102, { status: 'done', outcome: 'stuck' });
    await run();
    expect(stateOf(3102)).toMatchObject({ attempts: 1 });
  });
});

describe('what the team holds of the reporters', () => {
  it('AC-9: its job and its events hold the issue and its count, and no workspace, repository or login of a reporter', async () => {
    const { fake, run } = setup({ bugs: [bug(3102, { count: 2 })] });
    await run();
    fake.endBug(3102, { status: 'done', outcome: 'human' });
    await run();
    expect(fake.bugJobs().map((one) => one.line)).toEqual(['/omni:bug-fix #3102']);
    for (const event of fake.events()) {
      expect(event.sentence).toMatch(/#3102 \(reported 2×\)/);
      expect(event.sentence).not.toMatch(/vertuoza|ws-omni|bug-squad|@/);
      expect(event.link).toBe(`https://github.com/${REPO}/issues/3102`);
    }
  });
});

describe('a standing mission', () => {
  it('never ends delivered: with no bug to take it waits, a minute on', async () => {
    const { fake, run } = setup({ bugs: [] });
    expect(await run()).toEqual({ outcome: 'later', at: new Date(NOW + MINUTE), progress: { laters: 1 } });
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: null });
    expect(fake.events()).toEqual([]);
  });

  it('takes no bug without a read of its issues, saying why', async () => {
    const { fake, run } = setup({ bugs: [bug(3102)], issues: false });
    await run();
    expect(fake.bugJobs()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: "the app cannot read the Omni Loop bugs' issues here: it has no GitHub access" });
  });

  it('reads no issue while nothing can be taken: every slot is held', async () => {
    const { run, github } = setup({ bugs: [bug(3102, { count: 7 }), bug(3101)] });
    await run();
    await run();
    expect(github.asked).toHaveLength(1);
    expect(github.asked[0]).toEqual({ installation: 1, repo: REPO, issues: [3102, 3101] });
  });

  it('sends nothing over its token budget, and pauses (PRD 3040)', async () => {
    const { fake, run } = setup({ mission: team({ tokens: 1000 }), bugs: [bug(3102)] });
    fake.spend({ mission: 1100 });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.bugJobs()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'paused' });
  });

  it('paused by a person, reads its jobs\' ends and sends nothing new', async () => {
    const { fake, run, stateOf } = setup({ bugs: [bug(3102, { count: 7 }), bug(3101)] });
    await run();
    fake.status('paused');
    fake.endBug(3102, { status: 'done', outcome: 'stuck' });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(stateOf(3102)).toMatchObject({ state: 'open', attempts: 1 });
    expect(fake.bugJobs()).toHaveLength(1);
    expect(fake.mission().status).toBe('paused');
  });
});
