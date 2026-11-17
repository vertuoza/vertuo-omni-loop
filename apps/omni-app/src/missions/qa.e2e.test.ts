// A fake fleet checks each built PRD with QA before the Reviewer, and fixes its bugs (PRD 3001 s4). The real supervisor and the
// real job handler run against the mission's store in memory, a fake GitHub for the feature and fix pull requests, and runner ends
// the test hands out, QA's verdict read from its record line by the kit as the store reads it: no database, no runner, no model
// call, no GitHub. Beside `mission.e2e.test.ts`, which proves BR-PRODUCT-139.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { qaLine } from 'omni-loop/kit/lib/qa/verdict.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { Merged, MissionJoins } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

const ID = '4c2a7e91-5b3d-4f60-8a1c-9d0e2b4f6a73';
const T0 = Date.parse('2027-01-25T08:00:00Z');
const prd = (n: number): PrdNumber => parsePrd(n);
const pr = (n: number) => `https://github.com/acme/gadgets/pull/${String(n)}`;
const comment = (n: number, id: number) => `${pr(n)}#issuecomment-${String(id)}`;

/** A pull request of the fake GitHub, green and open unless told otherwise. */
const pull = (number: number, over: Partial<PullRead> = {}): PullRead => ({
  number,
  url: pr(number),
  title: `pull request ${String(number)}`,
  state: 'open',
  draft: false,
  merged: false,
  base: 'main',
  defaultBranch: 'main',
  head: 'f'.repeat(40),
  runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
  statuses: [],
  reviews: [],
  items: { ranks: [] },
  ...over,
});

/** A GitHub holding `pulls`: a merge marks one merged into its base, and is kept. */
function githubOf(pulls: Record<number, PullRead>) {
  const merges: { pr: number; base: string }[] = [];
  const joins: MissionJoins = {
    read: (at) => {
      const one = pulls[at.pr];
      return one ? Promise.resolve({ ...one }) : Promise.reject(new Error(`no pull request #${String(at.pr)}`));
    },
    merge: (at): Promise<Merged> => {
      merges.push({ pr: at.pr, base: at.base });
      const one = pulls[at.pr];
      if (one) pulls[at.pr] = { ...one, merged: true, state: 'closed' };
      return Promise.resolve({ ok: true });
    },
  };
  return { pulls, merges, joins };
}

/** A mission of the PRDs `prds` at `with-you`, each on ground of its own, its feature pull request #70 + n on `feat/prd-<n>`. */
function checked(prds: number[]) {
  const record: MissionRecord = { id: ID, workspace: 'ws-3', repo: 'acme/gadgets', fleet: 'day-shift', number: parseIssue(14), title: 'Checked quotes', level: 'with-you', status: 'running', waitingOn: null, parallel: 3, scope: { prds: prds.map(prd), roadmaps: [] } };
  const facts: PrdFacts[] = prds.map((n) => ({ prd: prd(n), approval: 'standing', stage: 'open', blockers: [], territory: [`packages/part-${String(n)}/`] }));
  const fake = fakeMissionStore({ mission: record, facts });
  const github = githubOf(Object.fromEntries(prds.map((n) => [40 + n, pull(40 + n, { branch: `feat/prd-${String(n)}` })])));
  let now = T0;
  const handler = missionHandler({ store: fake.store, joins: github.joins, refresh: () => Promise.resolve('again'), now: () => now, log: () => undefined });
  const job: ClaimedJob = { id: 'bg-14', kind: MISSION_KIND, key: `mission:${ID}`, subject: 'acme/gadgets', payload: { mission: ID }, tries: 1, claim: 'claim-14', claimedUntil: new Date(T0 + 600_000).toISOString(), progress: {}, lane: `mission:${ID}` };
  /** One run of the mission, a minute after the last. */
  const tick = async () => {
    now += 60_000;
    await handler(job);
  };
  /** Two runs of the mission at once, reading the same state. */
  const twice = async () => {
    fake.together(2);
    await Promise.all([handler(job), handler(job)]);
  };
  const linesOf = (n: number) => fake.jobs().filter((one) => one.prd === prd(n)).map((one) => one.line);
  const lastJob = (n: number) => fake.jobs().filter((one) => one.prd === prd(n)).at(-1);
  /** PRD `n`'s QA job ends on the line `/omni:qa` prints, read as the store reads it. */
  const qaEnds = (n: number, line: string) => {
    fake.end(prd(n), { status: 'done', prUrl: pr(40 + n), checked: qaLine(`checking the preview\n${line}`) });
  };
  return { fake, github, tick, twice, linesOf, lastJob, qaEnds };
}

const bugs = (n: number, round: 1 | 2, ...issues: number[]) =>
  `omni qa: posted round ${String(round)} (bugs, ${String(issues.length)}: ${issues.map((one) => `#${String(one)}`).join(' ')}) on PR #${String(40 + n)}: ${comment(40 + n, round)}`;
const passed = (n: number, round: 1 | 2) => `omni qa: posted round ${String(round)} (pass) on PR #${String(40 + n)}: ${comment(40 + n, round)}`;

describe('a fake fleet checks each built PRD with QA before the Reviewer (PRD 3001 s4)', () => {
  it('AC-1, AC-2: a build ready for review goes to QA, not the Reviewer; a pass in round 1 goes to the Reviewer, with no round 2', async () => {
    const { fake, tick, linesOf, qaEnds } = checked([30]);
    await tick();
    fake.end(prd(30), { status: 'done', outcome: 'review', prUrl: pr(70) });
    await tick();
    expect(fake.jobs().at(-1)).toMatchObject({ line: '/omni:qa 30', key: `mission:${ID}:prd:30:run:1:qa:1`, sentByApp: 'omni-app', toFleet: 'day-shift' });
    expect(linesOf(30)).toEqual(['/omni:yolo 30 --for-review', '/omni:qa 30']);
    qaEnds(30, passed(30, 1));
    await tick();
    expect(linesOf(30)).toEqual(['/omni:yolo 30 --for-review', '/omni:qa 30', '/omni:review 30']);
    expect(fake.events().filter((event) => event.kind === 'checked').map(({ role, actor, link, sentence }) => [role, actor, link, sentence])).toEqual([['qa', 'agent', comment(70, 1), 'pass · Round 1 of 2']]);
  });

  it('AC-3, AC-4, AC-5, AC-7: each bug goes to the Engineer one at a time, its fix lands on the feature branch, round 2 follows, and a bug still there waits on a person', async () => {
    const { fake, github, tick, twice, linesOf, lastJob, qaEnds } = checked([31]);
    await tick();
    fake.end(prd(31), { status: 'done', outcome: 'review', prUrl: pr(71) });
    await tick();
    qaEnds(31, bugs(31, 1, 12, 13));
    await tick();
    // The first bug alone, fixed into the PRD's feature branch, read from the feature pull request QA checked.
    expect(fake.jobs().at(-1)).toMatchObject({ line: '/omni:bug-fix #12 --base feat/prd-31', key: `mission:${ID}:prd:31:run:1:qa-fix:1:1` });
    await tick();
    await twice();
    expect(fake.jobs()).toHaveLength(3);

    // Its fix pull request is still running its checks: nothing lands, nothing more is sent.
    github.pulls[15] = pull(15, { base: 'feat/prd-31', runs: [{ id: 1, name: 'test', status: 'in_progress', conclusion: null, title: null }] });
    fake.end(prd(31), { status: 'done', outcome: 'pr-opened', prUrl: pr(15) });
    await tick();
    expect(github.merges).toEqual([]);
    expect(fake.jobs()).toHaveLength(3);
    expect(fake.mission().waitingOn).toBe('PRD 31: its fix #15 waits: test not finished');

    // Green: it lands on the feature branch, never the default branch, and the second bug goes.
    github.pulls[15] = pull(15, { base: 'feat/prd-31' });
    await tick();
    expect(github.merges).toEqual([{ pr: 15, base: 'feat/prd-31' }]);
    expect(fake.jobs().at(-1)).toMatchObject({ line: '/omni:bug-fix #13 --base feat/prd-31', key: `mission:${ID}:prd:31:run:1:qa-fix:1:2` });

    // The second fix finds its reproduction passing: it is marked, and QA's round 2 goes.
    fake.end(prd(31), { status: 'done', outcome: 'already-fixed' });
    await tick();
    expect(fake.jobs().at(-1)).toMatchObject({ line: '/omni:qa 31 --round 2', key: `mission:${ID}:prd:31:run:1:qa:2` });
    await twice();
    expect(fake.jobs()).toHaveLength(5);

    // Round 2 finds #13 still there: the PRD waits on a person, and nothing more is sent, run after run.
    qaEnds(31, bugs(31, 2, 13));
    await tick();
    await tick();
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 31: decide bug #13' });
    expect(fake.jobs()).toHaveLength(5);

    // The person sends it on to the Reviewer.
    fake.pickBugs(prd(31), lastJob(31)?.id ?? '', 'review');
    await tick();
    await twice();
    expect(linesOf(31)).toEqual(['/omni:yolo 31 --for-review', '/omni:qa 31', '/omni:bug-fix #12 --base feat/prd-31', '/omni:bug-fix #13 --base feat/prd-31', '/omni:qa 31 --round 2', '/omni:review 31']);
    // Every key once.
    expect(new Set(fake.jobs().map((one) => one.key)).size).toBe(fake.jobs().length);

    // The ledger: QA's verdicts signed qa, the Engineer's fixes, as agents, in the order they happened.
    const rows = fake.events().filter((event) => event.kind === 'checked' || (event.kind === 'job-ended' && event.role === 'engineer' && /fixed/.test(event.sentence)));
    expect(rows.map(({ kind, role, actor, sentence }) => [kind, role, actor, sentence])).toEqual([
      ['checked', 'qa', 'agent', '2 bugs found · Round 1 of 2 · #12 #13'],
      ['job-ended', 'engineer', 'agent', 'fixed #12 · PR #15'],
      ['job-ended', 'engineer', 'agent', 'not fixed #13: its reproduction passed on the branch'],
      ['checked', 'qa', 'agent', '1 bug still there · Round 2 of 2 · #13'],
    ]);
  });

  it('AC-5: a person stops the PRD on Decide the bugs: it stops, is never repaired, and nothing more is sent', async () => {
    const { fake, tick, lastJob, qaEnds } = checked([32]);
    await tick();
    fake.end(prd(32), { status: 'done', outcome: 'review', prUrl: pr(72) });
    await tick();
    qaEnds(32, bugs(32, 1, 21));
    await tick();
    fake.end(prd(32), { status: 'done', outcome: 'not-a-bug' });
    await tick();
    qaEnds(32, bugs(32, 2, 21));
    await tick();
    fake.pickBugs(prd(32), lastJob(32)?.id ?? '', 'stop', 'grace');
    await tick();
    expect(fake.mission()).toMatchObject({ status: 'stopped', waitingOn: 'PRD 32 stopped: a person stopped it with #21 still there after QA\'s round 2. Take it to ready by hand and the mission carries on.' });
    expect(fake.repairJobs()).toEqual([]);
    expect(fake.jobs()).toHaveLength(4);
    // The person's own stopped row stands for the PRD's: the supervisor records no second one.
    expect(fake.events().filter((event) => event.kind === 'stopped' && event.prd === prd(32)).map(({ actor }) => actor)).toEqual(['grace']);
  });

  it('AC-6: a QA job whose last line names six bugs, or none, is a failed step: the mission sends a repair', async () => {
    for (const line of [`omni qa: posted round 1 (bugs, 6: #1 #2 #3 #4 #5 #6) on PR #73: ${comment(73, 1)}`, 'it ran out of time']) {
      const { fake, tick, lastJob, qaEnds } = checked([33]);
      await tick();
      fake.end(prd(33), { status: 'done', outcome: 'review', prUrl: pr(73) });
      await tick();
      qaEnds(33, line);
      await tick();
      const failed = lastJob(33)?.id ?? '';
      expect(fake.repairJobs().map((one) => one.line)).toEqual([`/omni:repair --mission 14 --prd 33 --job ${failed}`]);
      expect(fake.events().filter((event) => event.kind === 'job-ended' && event.job === failed).map(({ role, sentence }) => [role, sentence])).toEqual([['qa', 'PRD 33\'s job failed: verdict not read.']]);
    }
  });
});
