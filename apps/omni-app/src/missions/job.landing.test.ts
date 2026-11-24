import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { agreeSentence, overturnSentence } from 'omni-loop/kit/lib/mission/overturn.ts';
import type { Criterion } from 'omni-loop/kit/lib/ready/criteria.ts';
import { MISSION_KIND, missionHandler, type MissionRetests } from './job.ts';
import type { MissionJoins } from './join.ts';
import type { KeptUp, MissionKeepUps } from './keep-up.ts';
import { landingAnswers, missionPullBody, type BranchCommit, type MissionLandings, type MissionPull } from './landing.ts';
import type { AgreeAt, MissionAgrees, MissionAnswers } from './settle.ts';
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
    expect(body).toContain(`- s1-01-colour of PRD 1 · carried by the fleet, option A · on the escalation list: bears on business law BL-QUOTES-1. [Agree](${GALAXY}/app/ai-fleet?fleet=night-shift&tab=missions&mission=12&decision=1%2Fs1-01-colour&answer=agree)`);
    expect(body).toContain(`- s2-01-shape of PRD 2 · deferred, option A taken meanwhile · architect no: the shape is not settled. [Agree](${GALAXY}/app/ai-fleet?fleet=night-shift&tab=missions&mission=12&decision=2%2Fs2-01-shape&answer=agree) · [Overturn](${GALAXY}/app/ai-fleet?fleet=night-shift&tab=missions&mission=12&decision=2%2Fs2-01-shape&answer=overturn)`);
  });
});

// ── PRD omni-loop-21 s15 (item s12-01): the landing, in the run ──────────────────────────────────────────────────────────────────
//
// The mission job lands the mission once every row joined its branch: the mission pull request then carries the Deferred decisions
// and the Re-test. A person's Agree reaches ./settle.ts › agree; an Overturn queues the PRD's rework on the mission branch.

const CRITERION: Criterion = { number: 1, kind: 'test', scenario: 'A quote total is rounded once', steps: [{ keyword: 'Given', text: 'a quote of 10.005' }, { keyword: 'Then', text: 'its total reads 10.01' }], lines: [] };

/** Reads PRD `n`'s one criterion, proven by a test on its feature pull request's head. */
function retestsOf() {
  const asked: { repo: string; prd: string; pr: PrNumber | null }[] = [];
  const retests: MissionRetests = {
    read: ({ repo, prd, pr: feature }) => {
      asked.push({ repo, prd: String(prd), pr: feature });
      return Promise.resolve({ criteria: [CRITERION], proofs: [{ ac: 1, kind: 'test', state: 'passed', title: 'AC-1: rounds once', proof: `apps/area-${String(prd)}/total.test.ts` }] });
    },
  };
  return { retests, asked };
}

/** What the route records of a person's answer, signed with their login: the fake store signs every event it records `agent`. */
type PersonEvent = { kind: 'agreed' | 'overturned'; prd: PrdNumber; sentence: string; actor: string };

function alone({ agreeFails = false } = {}) {
  const gh = githubOf();
  const fake = fakeMissionStore({ mission: record({ level: 'alone' }), facts: [facts(1), facts(2, { blockers: [p(1)] })] });
  const people: PersonEvent[] = [];
  // The store reads a person's `agreed` and `overturned` events beside the fleet's (item s12-02 stores the first).
  const store = { ...fake.store, fleetEvents: async (id: string) => [...(await fake.store.fleetEvents(id)), ...people.map((one) => ({ ...one, link: null }))] };
  const agreed: AgreeAt[] = [];
  const answers: MissionAnswers & MissionAgrees = {
    settle: () => Promise.resolve({ ok: true, settled: true }),
    agree: (at) => {
      agreed.push(at);
      return Promise.resolve(agreeFails ? { ok: false, why: 'the ledger moved since it was read' } : { ok: true, settled: true });
    },
  };
  const { retests, asked } = retestsOf();
  const run = () => missionHandler({ store, branches, joins: gh.joins, landings: gh.landings, answers, retests, galaxyUrl: GALAXY, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  const verdicts = [{ role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' }];
  /** The fleet carried PRD 1's item off the escalation list and deferred PRD 2's, as the members' meeting records them. */
  const decide = async () => {
    await fake.store.decideItem(fake.mission(), { prd: p(1), item: 's1-01-colour', job: 'ask-1', verdicts, decision: { outcome: 'carried', why: ['on the escalation list: bears on business law BL-QUOTES-1'], option: null } });
    await fake.store.decideItem(fake.mission(), { prd: p(2), item: 's2-01-shape', job: 'ask-2', verdicts, decision: { outcome: 'deferred', why: ['architect no: the shape is not settled'], option: 'A' } });
  };
  /** Both PRDs ended Ready and joined, one run each. */
  const joinBoth = async () => {
    await run();
    readyOn(fake, 1);
    await run();
    readyOn(fake, 2);
    await run();
  };
  return { fake, gh, run, people, agreed, asked, decide, joinBoth };
}

const link = (name: string, answer: string): string => `${GALAXY}/app/ai-fleet?fleet=night-shift&tab=missions&mission=12&decision=${encodeURIComponent(name)}&answer=${answer}`;

describe('the landing, in the mission run (PRD omni-loop-21 s15, AC-7)', () => {
  it('AC-7: lands once every row joined: the mission pull request lists the carried and the deferred decision, each with Agree and Overturn, and the Re-test per PRD', async () => {
    const { gh, run, asked, decide, fake } = alone();
    await decide();
    await run();
    readyOn(fake, 1);
    await run();
    // One row joined: the pull request lists it, and no landing yet.
    expect(gh.writes).toHaveLength(1);
    expect(gh.writes[0]?.body).not.toContain('**Re-test**');
    expect(asked).toEqual([]);
    readyOn(fake, 2);
    await run();
    const body = gh.writes.at(-1)?.body ?? '';
    expect(gh.writes.at(-1)?.pull).toBe(pr(60));
    expect(body).toContain('**Deferred decisions**');
    expect(body).toContain(`- s1-01-colour of PRD 1 · carried by the fleet, option A · on the escalation list: bears on business law BL-QUOTES-1. [Agree](${link('1/s1-01-colour', 'agree')}) · [Overturn](${link('1/s1-01-colour', 'overturn')})`);
    expect(body).toContain(`- s2-01-shape of PRD 2 · deferred, option A taken meanwhile · architect no: the shape is not settled. [Agree](${link('2/s2-01-shape', 'agree')})`);
    expect(body).toContain(`**Re-test**\n\nBefore you merge, try \`${BRANCH}\``);
    expect(body).toContain('*PRD 1*\n\n- AC-1 · test · A quote total is rounded once: passed, `apps/area-1/total.test.ts`');
    expect(body).toContain('*PRD 2*\n\n- AC-1 · test · A quote total is rounded once: passed, `apps/area-2/total.test.ts`');
    expect(body).toContain('Try by hand:\n\n- [ ] AC-1: Given a quote of 10.005; Then its total reads 10.01');
    // The criteria are read from each PRD's own feature pull request.
    expect(asked).toEqual([
      { repo: 'acme/widgets', prd: '1', pr: pr(41) },
      { repo: 'acme/widgets', prd: '2', pr: pr(42) },
    ]);
    // The table and the Rebase and merge line stay: one mission pull request, never a second one for one repository.
    expect(body).toContain('| 2 | PRD 2 | #42');
    expect(gh.mission).toHaveLength(1);
  });

  it('AC-7: writes the landed body once, and again only when what it lists changed', async () => {
    const { gh, run, joinBoth } = alone();
    await joinBoth();
    const writes = gh.writes.length;
    await run();
    await run();
    expect(gh.writes).toHaveLength(writes);
  });

  it('AC-7: lists no Deferred decisions below alone, and still lands with the Re-test', async () => {
    const gh = githubOf();
    const fake = fakeMissionStore({ mission: record(), facts: [facts(1)] });
    const { retests } = retestsOf();
    const run = () => missionHandler({ store: fake.store, branches, joins: gh.joins, landings: gh.landings, retests, galaxyUrl: GALAXY, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
    await run();
    readyOn(fake, 1);
    await run();
    const body = gh.writes.at(-1)?.body ?? '';
    expect(body).not.toContain('**Deferred decisions**');
    expect(body).toContain('*PRD 1*\n\n- AC-1 · test');
  });

  it('AC-7: with no reader of the criteria, says so per PRD rather than inventing a proof', async () => {
    const gh = githubOf();
    const fake = fakeMissionStore({ mission: record(), facts: [facts(1)] });
    const run = () => missionHandler({ store: fake.store, branches, joins: gh.joins, landings: gh.landings, galaxyUrl: GALAXY, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
    await run();
    readyOn(fake, 1);
    await run();
    expect(gh.writes.at(-1)?.body).toContain('*PRD 1*\n\n- No acceptance criteria were read for it: try what its page says.');
  });
});

describe('Agree and Overturn reach the run (PRD omni-loop-21 s15, AC-8)', () => {
  it('AC-8: an Agree settles the item on the mission branch in the person\'s name, and the pull request says who agreed', async () => {
    const { run, people, agreed, decide, joinBoth, gh } = alone();
    await decide();
    await joinBoth();
    people.push({ kind: 'agreed', prd: p(1), sentence: agreeSentence('ada', '1/s1-01-colour'), actor: 'ada' });
    await run();
    expect(agreed).toEqual([{ installation: 1, repo: 'acme/widgets', branch: BRANCH, prd: p(1), item: 's1-01-colour', login: 'ada', at: new Date(NOW).toISOString() }]);
    expect(gh.writes.at(-1)?.body).toContain('- s1-01-colour of PRD 1 · carried by the fleet, option A · on the escalation list: bears on business law BL-QUOTES-1. Agreed by ada.');
  });

  it('AC-8: an Agree that cannot be settled waits on a person, saying why, and is tried again on the next run', async () => {
    const { fake, run, people, agreed, decide, joinBoth } = alone({ agreeFails: true });
    await decide();
    await joinBoth();
    people.push({ kind: 'agreed', prd: p(1), sentence: agreeSentence('ada', '1/s1-01-colour'), actor: 'ada' });
    await run();
    expect(fake.mission().waitingOn).toContain(`s1-01-colour of PRD 1: ada's Agree is not settled on ${BRANCH} yet: the ledger moved since it was read`);
    await run();
    expect(agreed).toHaveLength(2);
  });

  it('AC-8: an Overturn queues the PRD\'s rework on the mission branch, once, and the pull request says the fleet reworks it', async () => {
    const { fake, run, people, decide, joinBoth, gh } = alone();
    await decide();
    await joinBoth();
    people.push({ kind: 'overturned', prd: p(2), sentence: overturnSentence('ada', { prd: p(2), item: 's2-01-shape' }, 'keep the old shape'), actor: 'ada' });
    await run();
    await run();
    expect(fake.cares().map(({ line, toFleet }) => [line, toFleet])).toEqual([[`/omni:yolo-fix 2 --base ${BRANCH}`, 'night-shift']]);
    expect(fake.events().filter((event) => event.kind === 'dispatched' && event.prd === p(2)).map((event) => event.sentence).at(-1)).toBe(
      `A person overturned a decision of PRD 2: sent /omni:yolo-fix 2 --base ${BRANCH} to the night-shift fleet's runners.`,
    );
    expect(gh.writes.at(-1)?.body).toContain('Overturned by ada: the fleet reworks PRD 2 on the mission branch.');
  });

  it('AC-8: sends no rework and settles nothing while nobody answered', async () => {
    const { fake, run, agreed, decide, joinBoth } = alone();
    await decide();
    await joinBoth();
    await run();
    expect(fake.cares()).toEqual([]);
    expect(agreed).toEqual([]);
  });
});
