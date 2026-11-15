import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { DropAt, Dropped, MissionDrops } from './drop.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { BranchChecks, Merged, MissionJoins, PullAt } from './join.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// A person drops a PRD from the mission branch (PRD 2896 s7, criterion 11): the ask is an event, the run takes the PRD off the
// branch with the later PRDs sharing its territory (unless --keep), records each drop, and never joins a dropped PRD again; a red
// branch holds every join and names the PRD to drop.

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
  parallel: 3,
  scope: { prds: [p(1), p(2), p(3)], roadmaps: [] },
  ...over,
});
const facts = (n: number, territory: string[]): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory });

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

const green: BranchChecks = { head: HEAD, runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }], statuses: [] };
const red: BranchChecks = { head: HEAD, runs: [{ id: 2, name: 'test', status: 'completed', conclusion: 'failure', title: null }], statuses: [] };

/** A GitHub whose pull requests pass the gate, whose branch checks read as `branch.now`, and whose drops are kept. */
function github(answer: (at: DropAt) => Dropped = (at) => ({ ok: true, removed: at.prds.map(({ prd }) => prd), absent: [], reopened: at.prds.map(({ prd, pr }) => ({ prd, pr: parsePr(pr + 100), url: `https://github.com/acme/widgets/pull/${String(pr + 100)}`, why: null })) })) {
  const pulls: Record<number, PullRead> = { 41: passing(41), 42: passing(42), 43: passing(43) };
  const merges: number[] = [];
  const dropsMade: DropAt[] = [];
  const branch = { now: green };
  const joins: MissionJoins = {
    read: (at: PullAt) => Promise.resolve({ ...(pulls[at.pr] ?? passing(at.pr)) }),
    merge: (at): Promise<Merged> => {
      merges.push(at.pr);
      pulls[at.pr] = { ...(pulls[at.pr] ?? passing(at.pr)), merged: true, state: 'closed' };
      return Promise.resolve({ ok: true });
    },
    checks: () => Promise.resolve(branch.now),
  };
  const drops: MissionDrops = {
    drop: (at) => {
      dropsMade.push(at);
      return Promise.resolve(answer(at));
    },
  };
  return { joins, drops, merges, dropsMade, branch };
}

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

/** A mission of three PRDs, each ended Ready on its own pull request and joined: 1 and 3 share ground, 2 does not. */
async function joined(over: { gh?: ReturnType<typeof github>; territories?: [string[], string[], string[]] } = {}) {
  const gh = over.gh ?? github();
  const [t1, t2, t3] = over.territories ?? [['apps/shared/'], ['apps/own/'], ['apps/shared/more/']];
  const fake = fakeMissionStore({ mission: record(), facts: [facts(1, t1), facts(2, t2), facts(3, t3)] });
  const run = () => missionHandler({ store: fake.store, branches, joins: gh.joins, drops: gh.drops, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  const ready = (n: number) => {
    fake.end(p(n), { status: 'done', outcome: 'ready', prUrl: `https://github.com/acme/widgets/pull/${String(40 + n)}` });
  };
  // PRD 3 shares ground with PRD 1, so it is sent once PRD 1 has joined.
  await run();
  ready(1);
  ready(2);
  await run();
  ready(3);
  await run();
  expect(gh.merges).toEqual([41, 42, 43]);
  return { fake, gh, run };
}

describe('a PRD is dropped from the mission branch (criterion 11)', () => {
  it('takes it off with the later PRDs sharing its territory, reopens their pull requests and records each drop once', async () => {
    const { fake, gh, run } = await joined();
    fake.asked(p(1));
    await run();
    expect(gh.dropsMade).toEqual([{ installation: 1, repo: 'acme/widgets', branch: BRANCH, prds: [{ prd: 1, pr: 41 }, { prd: 3, pr: 43 }] }]);
    expect(fake.events().filter((event) => event.kind === 'prd-dropped')).toEqual([
      expect.objectContaining({ role: 'supervisor', actor: 'agent', prd: 1, link: 'https://github.com/acme/widgets/pull/141', sentence: `PRD 1 was dropped from ${BRANCH}: its commit is off the branch, #141 reopened.` }),
      expect.objectContaining({ prd: 3, sentence: `PRD 3 was dropped from ${BRANCH}, with PRD 1, which shares its territory: its commit is off the branch, #143 reopened.` }),
    ]);
    // Replayed runs drop nothing twice, and a dropped PRD never joins again.
    await run();
    await run();
    expect(gh.dropsMade).toHaveLength(1);
    expect(gh.merges).toEqual([41, 42, 43]);
    expect(fake.events().filter((event) => event.kind === 'prd-dropped')).toHaveLength(2);
  });

  it('with --keep takes only that PRD, and the mission waits on the dropped ones until a person sends them again', async () => {
    const { fake, gh, run } = await joined();
    fake.asked(p(1), { keep: true });
    await run();
    expect(gh.dropsMade[0]?.prds).toEqual([{ prd: 1, pr: 41 }]);
    expect(fake.events().filter((event) => event.kind === 'prd-dropped').map((event) => event.prd)).toEqual([1]);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: expect.stringContaining(`PRD 1: dropped from ${BRANCH}, until a person sends it again`) as string });
  });

  it('changes no branch and waits on a person, naming why, when the drop cannot be made; it tries again on the next run', async () => {
    const gh = github(() => ({ ok: false, why: `${BRANCH} cannot do without PRD 1 dropped: "feat: PRD 3" conflicts once they are off it; drop the PRD built on them too, and nothing changed` }));
    const { fake, run } = await joined({ gh });
    fake.asked(p(1), { keep: true });
    await run();
    expect(fake.events().some((event) => event.kind === 'prd-dropped')).toBe(false);
    expect(fake.mission().waitingOn).toContain(`PRD 1 cannot be dropped from ${BRANCH}: ${BRANCH} cannot do without PRD 1 dropped`);
    await run();
    expect(gh.dropsMade).toHaveLength(2);
  });

  it('voids an ask for a PRD that is not on the branch, and asks GitHub nothing', async () => {
    const gh = github();
    const fake = fakeMissionStore({ mission: record(), facts: [facts(1, ['apps/a/']), facts(2, ['apps/b/']), facts(3, ['apps/c/'])] });
    const run = () => missionHandler({ store: fake.store, branches, joins: gh.joins, drops: gh.drops, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
    await run();
    fake.asked(p(2));
    await run();
    expect(gh.dropsMade).toEqual([]);
  });

  it('asks GitHub nothing while the mission is paused: the ask stands until it runs again', async () => {
    const { fake, gh, run } = await joined();
    fake.status('paused');
    fake.asked(p(2));
    await run();
    expect(gh.dropsMade).toEqual([]);
    fake.status('running');
    await run();
    expect(gh.dropsMade).toHaveLength(1);
  });
});

describe('a red mission branch holds every join and names the PRD to drop (criterion 11)', () => {
  it('waits on a person, naming the PRD that joined last and the drop line, and joins nothing more', async () => {
    const gh = github();
    const fake = fakeMissionStore({ mission: record(), facts: [facts(1, ['apps/a/']), facts(2, ['apps/b/'])] });
    const run = () => missionHandler({ store: fake.store, branches, joins: gh.joins, drops: gh.drops, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
    await run();
    fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/41' });
    await run();
    expect(gh.merges).toEqual([41]);
    gh.branch.now = red;
    fake.end(p(2), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/42' });
    await run();
    expect(gh.merges).toEqual([41]);
    expect(fake.mission().status).toBe('waiting');
    expect(fake.mission().waitingOn).toContain(`${BRANCH} is red (test) since PRD 1 joined: no further PRD joins; run omni mission drop 12 1 to take it off`);
    // Green again: the join goes on.
    gh.branch.now = green;
    await run();
    expect(gh.merges).toEqual([41, 42]);
  });

  it('reads no checks while no PRD is on the branch', async () => {
    const gh = github();
    let read = 0;
    gh.joins.checks = () => {
      read += 1;
      return Promise.resolve(red);
    };
    const fake = fakeMissionStore({ mission: record(), facts: [facts(1, ['apps/a/'])] });
    await missionHandler({ store: fake.store, branches, joins: gh.joins, drops: gh.drops, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
    expect(read).toBe(0);
  });
});
