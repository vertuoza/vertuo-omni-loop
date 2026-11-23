import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins } from './join.ts';
import type { KeptUp, MissionKeepUps } from './keep-up.ts';
import { landingAnswers, missionPullBody, type BranchCommit, type MissionLandings, type MissionPull } from './landing.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// The mission pull request (PRD 2896 s6, criterion 9): opened when the first PRD joins, listing each PRD with its commit, its
// Reviewer verdict and its page, rewritten on every join; once a person merges it, each PRD it carried is shipped from then, and
// the next one opens for the PRDs that remain.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
const HEAD = 'a'.repeat(40);
const GALAXY = 'https://omni.example.com';
const p = (n: number): PrdNumber => parsePrd(n);
const pr = (n: number): PrNumber => parsePr(n);

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
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], page: `page-${String(n)}`, ...over });

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

const passing = (number: number): PullRead => ({
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
});

/** A GitHub whose feature pull requests pass the gate, and whose squash-merge puts a commit on the mission branch. */
function githubOf() {
  const pulls: Record<number, PullRead> = { 41: passing(41), 42: passing(42) };
  const branch: BranchCommit[] = [];
  const mission: MissionPull[] = [];
  const writes: { pull: PrNumber | null; title: string; body: string }[] = [];
  const asked: string[] = [];
  const joins: MissionJoins = {
    read: (at) => Promise.resolve({ ...(pulls[at.pr] ?? passing(at.pr)) }),
    merge: (at) => {
      const pull = pulls[at.pr];
      if (pull) pulls[at.pr] = { ...pull, merged: true, state: 'closed' };
      branch.push({ sha: String(at.pr).repeat(20).slice(0, 40), pr: at.pr });
      return Promise.resolve({ ok: true });
    },
  };
  const landings: MissionLandings = {
    landings: () => {
      asked.push('landings');
      return Promise.resolve({ defaultBranch: 'main', pulls: mission.map((one) => ({ ...one, carried: [...one.carried] })).reverse() });
    },
    branch: () => {
      asked.push('branch');
      return Promise.resolve({ commits: branch.map((one) => ({ ...one })), link: 'Closes #{prd}' });
    },
    write: ({ pull, title, body }) => {
      writes.push({ pull, title, body });
      if (pull !== null) {
        const open = mission.find((one) => one.number === pull);
        if (open) Object.assign(open, { title, body });
        return Promise.resolve({ ok: true, number: pull, url: `https://github.com/acme/widgets/pull/${String(pull)}`, created: false });
      }
      const number = pr(60 + mission.length);
      mission.push({ number, url: `https://github.com/acme/widgets/pull/${String(number)}`, open: true, merged: false, title, body, carried: [] });
      return Promise.resolve({ ok: true, number, url: `https://github.com/acme/widgets/pull/${String(number)}`, created: true });
    },
  };
  /** A person merges mission pull request `n` with Rebase and merge: it carries every commit on the branch, which then follows main. */
  const land = (n: number) => {
    const pull = mission.find((one) => one.number === n);
    if (!pull) throw new Error(`no mission pull request #${String(n)}`);
    Object.assign(pull, { open: false, merged: true, carried: branch.flatMap((one) => (one.pr === null ? [] : [one.pr])) });
    branch.length = 0;
  };
  return { joins, landings, writes, asked, land, mission };
}

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

function setup({ mission = record(), all = [facts(1), facts(2, { blockers: [p(1)] })], keepUps = null as MissionKeepUps | null } = {}) {
  const gh = githubOf();
  const fake = fakeMissionStore({ mission, facts: all });
  const run = () => missionHandler({ store: fake.store, branches, joins: gh.joins, keepUps, landings: gh.landings, galaxyUrl: GALAXY, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run, gh };
}

/** PRD `n`'s latest job ends Ready on pull request `40 + n`, its Reviewer's round 1 having passed it. */
function readyOn(fake: ReturnType<typeof setup>['fake'], n: number) {
  fake.end(p(n), { status: 'done', outcome: 'ready', prUrl: `https://github.com/acme/widgets/pull/${String(40 + n)}` });
}

describe('the mission pull request opens when the first PRD joins (criterion 9)', () => {
  it('opens one, never a draft, listing the PRD with its commit, the Reviewer\'s pass and its page, and the line that closes its issue', async () => {
    const { fake, run, gh } = setup();
    await run();
    readyOn(fake, 1);
    await run();
    expect(gh.writes).toHaveLength(1);
    const [opened] = gh.writes;
    expect(opened?.pull).toBeNull();
    expect(opened?.title).toBe('Mission #12: Faster quotes');
    expect(opened?.body).toContain(`| 1 | PRD 1 | #41 | \`4141414\` | pass | [its page](${GALAXY}/prd/page-1) |`);
    expect(opened?.body).toContain('**Merge it with Rebase and merge**');
    expect(opened?.body.trimEnd().endsWith('Closes #1')).toBe(true);
  });

  it('asks nothing of the mission pull request while no PRD joined, and rewrites nothing when its body did not change', async () => {
    const { fake, run, gh } = setup();
    await run();
    expect(gh.writes).toEqual([]);
    expect(gh.asked).not.toContain('branch');
    readyOn(fake, 1);
    await run();
    await run();
    await run();
    expect(gh.writes).toHaveLength(1);
  });

  it('rewrites the open one on every join, the PRDs in the order they joined', async () => {
    const { fake, run, gh } = setup();
    await run();
    readyOn(fake, 1);
    await run();
    // PRD 2, which PRD 1 blocked, was sent on the branch.
    readyOn(fake, 2);
    await run();
    expect(gh.writes.map((one) => one.pull)).toEqual([null, pr(60)]);
    const body = gh.writes[1]?.body ?? '';
    expect(body.indexOf('| 1 | PRD 1 | #41')).toBeGreaterThan(-1);
    expect(body.indexOf('| 2 | PRD 2 | #42')).toBeGreaterThan(body.indexOf('| 1 | PRD 1 | #41'));
    expect(body).toContain('Closes #1\nCloses #2');
  });

  it('never opens one at with-you, and asks GitHub nothing of it there', async () => {
    const { fake, run, gh } = setup({ mission: record({ level: 'with-you' }) });
    await run();
    readyOn(fake, 1);
    await run();
    expect(gh.writes).toEqual([]);
    expect(gh.asked).toEqual([]);
  });

  it('writes nothing while the branch cannot follow the default branch', async () => {
    const held: KeptUp = { branch: 'held', defaultBranch: 'main', why: 'it moved while it was being rebased: the next run reads it again' };
    const { fake, run, gh } = setup({ keepUps: { keepUp: () => Promise.resolve(held) } });
    await run();
    readyOn(fake, 1);
    await run();
    expect(gh.writes).toEqual([]);
  });
});

describe('a landing: each PRD is shipped once the mission pull request carried it to the default branch (criterion 9)', () => {
  it('records each PRD it carried merged, once, linking it, and the mission is delivered when every PRD landed', async () => {
    const { fake, run, gh } = setup();
    await run();
    readyOn(fake, 1);
    await run();
    readyOn(fake, 2);
    await run();
    // On the branch only, neither PRD is shipped.
    expect(fake.events().some((event) => event.kind === 'prd-merged')).toBe(false);
    gh.land(60);
    await run();
    await run();
    expect(fake.events().filter((event) => event.kind === 'prd-merged')).toEqual([
      expect.objectContaining({ role: 'supervisor', actor: 'agent', prd: p(1), link: 'https://github.com/acme/widgets/pull/60', sentence: 'PRD 1 landed on the default branch with #60: shipped.' }),
      expect.objectContaining({ prd: p(2), link: 'https://github.com/acme/widgets/pull/60' }),
    ]);
    expect(fake.mission().status).toBe('delivered');
    // Nothing remains on the branch: no next mission pull request.
    expect(gh.writes).toHaveLength(2);
  });

  it('landed in parts, opens the next mission pull request for the PRDs that joined after', async () => {
    const { fake, run, gh } = setup();
    await run();
    readyOn(fake, 1);
    await run();
    gh.land(60);
    await run();
    expect(fake.events().filter((event) => event.kind === 'prd-merged').map((event) => event.prd)).toEqual([p(1)]);
    expect(fake.mission().status).not.toBe('delivered');
    readyOn(fake, 2);
    await run();
    const next = gh.writes.at(-1);
    expect(next?.pull).toBeNull();
    expect(next?.body).toContain('| 1 | PRD 2 | #42');
    expect(next?.body).not.toContain('PRD 1 |');
    expect(gh.mission.map((one) => one.number)).toEqual([pr(60), pr(61)]);
  });
});

// PRD omni-loop-21 s12: what the store kept of the fleet's meeting is what the mission pull request lists as Deferred decisions.
describe('the deferred decisions, as the store keeps them (AC-7)', () => {
  it('AC-7: lists the carried and the deferred item the store recorded, each with its option, its PRD and the Agree and Overturn links', async () => {
    const fake = fakeMissionStore({ mission: record({ level: 'alone' }), facts: [facts(1), facts(2)] });
    const verdicts = [{ role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' }];
    await fake.store.decideItem(fake.mission(), { prd: p(1), item: 's1-01-colour', job: 'ask-1', verdicts, decision: { outcome: 'carried', why: ['on the escalation list: bears on business law BL-QUOTES-1'], option: null } });
    await fake.store.decideItem(fake.mission(), { prd: p(2), item: 's2-01-shape', job: 'ask-2', verdicts, decision: { outcome: 'deferred', why: ['architect no: the shape is not settled'], option: 'A' } });
    const answers = landingAnswers({ mission: fake.mission(), decisions: await fake.store.decisions(ID), events: await fake.store.fleetEvents(ID), galaxyUrl: GALAXY });
    const body = missionPullBody({ mission: fake.mission(), branch: BRANCH, defaultBranch: 'main', rows: [], link: null, answers });
    expect(body).toContain(`- s1-01-colour of PRD 1 · carried by the fleet, option A · on the escalation list: bears on business law BL-QUOTES-1. [Agree](${GALAXY}/app/fleet?fleet=night-shift&tab=missions&mission=12&decision=1%2Fs1-01-colour&answer=agree)`);
    expect(body).toContain(`- s2-01-shape of PRD 2 · deferred, option A taken meanwhile · architect no: the shape is not settled. [Agree](${GALAXY}/app/fleet?fleet=night-shift&tab=missions&mission=12&decision=2%2Fs2-01-shape&answer=agree) · [Overturn](${GALAXY}/app/fleet?fleet=night-shift&tab=missions&mission=12&decision=2%2Fs2-01-shape&answer=overturn)`);
  });
});
