import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { Merged, MissionJoins, PullAt } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// A PRD joins its mission's branch (PRD 2896 s4): a mission above with-you squash-merges a Ready PRD whose pull request passes the
// merge gate, once, and sends the PRDs it blocked; one that does not pass waits on what it lacks.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
const HEAD = 'a'.repeat(40);
const p = (n: number): PrdNumber => parsePrd(n);

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
  scope: { prds: [p(1), p(2)], roadmaps: [] },
  ...over,
});
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });

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

/** A pull request into the mission branch that passes the gate. */
const passing = (number: number, over: Partial<PullRead> = {}): PullRead => ({
  number,
  url: `https://github.com/acme/widgets/pull/${String(number)}`,
  title: `feat: PRD ${String(number)}`,
  state: 'open',
  draft: false,
  merged: false,
  base: BRANCH,
  defaultBranch: 'main',
  head: HEAD,
  runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
  statuses: [],
  reviews: [{ body: '<!-- omni-review: 1 pass -->', commit: HEAD }],
  items: { ranks: [] },
  ...over,
});

/** A GitHub whose pull requests read as `pulls` gives them; a merge marks one merged, unless `refuse` says why not. */
function githubOf(pulls: Record<number, PullRead>, refuse: string | null = null) {
  const reads: PullAt[] = [];
  const merges: (PullAt & { head: string; title: string })[] = [];
  const joins: MissionJoins = {
    read: (at) => {
      reads.push(at);
      const pull = pulls[at.pr];
      return pull ? Promise.resolve({ ...pull }) : Promise.reject(new Error(`no pull request #${String(at.pr)}`));
    },
    merge: (at): Promise<Merged> => {
      merges.push(at);
      if (refuse !== null) return Promise.resolve({ ok: false, why: refuse });
      const pull = pulls[at.pr];
      if (pull) pulls[at.pr] = { ...pull, merged: true, state: 'closed' };
      return Promise.resolve({ ok: true });
    },
  };
  return { reads, merges, joins };
}

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

function setup({ mission = record(), all = [facts(1), facts(2, { blockers: [p(1)] })], joins = null as MissionJoins | null } = {}) {
  const fake = fakeMissionStore({ mission, facts: all });
  const run = () => missionHandler({ store: fake.store, branches, joins, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run };
}

/** Sends PRD 1, then ends its job Ready on pull request 41. */
async function readyOn41(fake: ReturnType<typeof setup>['fake'], run: () => Promise<unknown>) {
  await run();
  expect(fake.jobs().map((job) => job.line)).toEqual([`/omni:yolo 1 --for-review --base ${BRANCH}`]);
  fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/41' });
}

describe('a Ready PRD joins the mission branch once the merge gate passes (criterion 6)', () => {
  it('squash-merges its pull request on the head judged, records the join, and sends the PRD it blocked (criterion 7)', async () => {
    const gh = githubOf({ 41: passing(41) });
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    await run();
    expect(gh.merges).toEqual([{ installation: 1, repo: 'acme/widgets', prd: p(1), pr: 41, head: HEAD, title: 'feat: PRD 41', base: BRANCH, defaultBranch: 'main' }]);
    expect(fake.events().filter((event) => event.kind === 'prd-joined')).toEqual([
      expect.objectContaining({ role: 'supervisor', actor: 'agent', prd: p(1), link: 'https://github.com/acme/widgets/pull/41', sentence: `PRD 1 joined ${BRANCH}: #41 squash-merged.` }),
    ]);
    // PRD 1 on the branch no longer counts toward a mandate of one: PRD 2, which it blocked, is sent on the branch.
    expect(fake.jobs().map((job) => job.line)).toEqual([`/omni:yolo 1 --for-review --base ${BRANCH}`, `/omni:yolo 2 --for-review --base ${BRANCH}`]);
  });

  it('records each join once, and merges once, when the run is replayed', async () => {
    const gh = githubOf({ 41: passing(41) });
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    await run();
    await run();
    await run();
    expect(gh.merges).toHaveLength(1);
    expect(fake.events().filter((event) => event.kind === 'prd-joined')).toHaveLength(1);
    // Once joined, its pull request is not read again.
    expect(gh.reads).toHaveLength(1);
  });

  it('joins without a second merge a pull request already merged into the branch, as after a run that failed before it recorded', async () => {
    const gh = githubOf({ 41: passing(41, { merged: true, state: 'closed' }) });
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    await run();
    expect(gh.merges).toEqual([]);
    expect(fake.events().filter((event) => event.kind === 'prd-joined')).toHaveLength(1);
  });
});

describe('a PRD the gate does not pass waits, saying on what (criterion 6)', () => {
  it('merges nothing on a red check, a missing pass or an open high item, and the mission names each', async () => {
    const gh = githubOf({ 41: passing(41, { runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'failure', title: null }], reviews: [], items: { ranks: ['high'] } }) });
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    await run();
    expect(gh.merges).toEqual([]);
    expect(fake.events().some((event) => event.kind === 'prd-joined')).toBe(false);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: `PRD 1: joins ${BRANCH} once: test failed; the Reviewer has not reviewed it; 1 high item open` });
    expect(fake.jobs()).toHaveLength(1);
  });

  it('merges nothing on a check that did not decide (BL-GATE-1)', async () => {
    const gh = githubOf({ 41: passing(41, { runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'neutral', title: 'not measured' }] }) });
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    await run();
    expect(gh.merges).toEqual([]);
    expect(fake.mission().waitingOn).toBe(`PRD 1: joins ${BRANCH} once: test not judged: not measured`);
  });

  it('joins on a later run, once the gate passes', async () => {
    const pulls = { 41: passing(41, { runs: [{ id: 1, name: 'test', status: 'in_progress', conclusion: null, title: null }] }) };
    const gh = githubOf(pulls);
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    await run();
    expect(fake.mission().waitingOn).toBe(`PRD 1: joins ${BRANCH} once: test not finished`);
    pulls[41] = passing(41);
    await run();
    expect(gh.merges).toHaveLength(1);
    expect(fake.mission().status).toBe('running');
  });

  it('waits on GitHub\'s refusal of the merge, and tries again on the next run', async () => {
    const gh = githubOf({ 41: passing(41) }, 'GitHub refused the merge: Head branch was modified.');
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    await run();
    expect(fake.mission().waitingOn).toBe(`PRD 1: joins ${BRANCH} once: GitHub refused the merge: Head branch was modified.`);
    await run();
    expect(gh.merges).toHaveLength(2);
    expect(fake.events().some((event) => event.kind === 'prd-joined')).toBe(false);
  });

  it('waits when no job of the PRD named its pull request', async () => {
    const gh = githubOf({});
    const { fake, run } = setup({ joins: gh.joins });
    await run();
    fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: null });
    await run();
    expect(gh.reads).toEqual([]);
    expect(fake.mission().waitingOn).toBe(`PRD 1: joins ${BRANCH} once: its feature pull request is not known to the mission`);
  });
});

describe('the gate asks GitHub nothing where no branch is joined', () => {
  it('at with-you a Ready PRD waits for a person to merge it, as before (criterion 2)', async () => {
    const gh = githubOf({ 41: passing(41) });
    const { fake, run } = setup({ mission: record({ level: 'with-you' }), joins: gh.joins });
    await run();
    fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/41' });
    await run();
    expect(gh.reads).toEqual([]);
    expect(fake.mission().waitingOn).toBe('PRD 1: merge it');
  });

  it('while the mission is paused, nothing is merged', async () => {
    const gh = githubOf({ 41: passing(41) });
    const { fake, run } = setup({ joins: gh.joins });
    await readyOn41(fake, run);
    fake.status('paused');
    await run();
    expect(gh.reads).toEqual([]);
    expect(gh.merges).toEqual([]);
  });

  it('without GitHub access the PRD waits, unjudged', async () => {
    const { fake, run } = setup({ joins: null });
    await readyOn41(fake, run);
    await run();
    expect(fake.mission().waitingOn).toBe(`PRD 1: joins ${BRANCH} once: the app has no GitHub access here`);
  });
});
