import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins } from './join.ts';
import type { FeatureKept, KeepUpAt, KeptUp, MissionKeepUps } from './keep-up.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// The mission branch follows the default branch (PRD 2896 s5, criterion 8): each run of a mission above with-you keeps it up
// before anything joins it; a real conflict waits on a person, naming the files, and a feature branch that conflicts only in
// generated paths gets one care job per head of the branch.

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
  parallel: 2,
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

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

/** A keeper answering each run with the next of `answers` (the last one again once they run out); every ask kept. */
function keeperOf(answers: KeptUp[]) {
  const asked: KeepUpAt[] = [];
  const keepUps: MissionKeepUps = {
    keepUp: (at) => {
      asked.push(at);
      return Promise.resolve((answers.length > 1 ? answers.shift() : answers[0]) ?? { branch: 'in-step', defaultBranch: 'main', since: '', features: [] });
    },
  };
  return { asked, keepUps };
}

/** A pull request into the mission branch that passes the gate. */
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

function setup({ mission = record(), keepUps = null as MissionKeepUps | null, joins = null as MissionJoins | null } = {}) {
  const fake = fakeMissionStore({ mission, facts: [facts(1), facts(2)] });
  const merges: number[] = [];
  const allJoins: MissionJoins = joins ?? {
    read: (at) => Promise.resolve(passing(at.pr)),
    merge: (at) => {
      merges.push(at.pr);
      return Promise.resolve({ ok: true });
    },
  };
  const run = () => missionHandler({ store: fake.store, branches, joins: allJoins, keepUps, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run, merges };
}

const inStep = (features: FeatureKept[] = [], since = '2027-01-22T08:00:00Z'): KeptUp => ({ branch: 'in-step', defaultBranch: 'main', since, features });

describe('each run keeps the mission branch up with the default branch (PRD 2896 s5)', () => {
  it('asks to keep up the mission branch with the feature pull requests of the PRDs whose job ended, never one still running', async () => {
    const keeper = keeperOf([inStep()]);
    const { fake, run } = setup({ keepUps: keeper.keepUps });
    await run();
    fake.end(p(1), { status: 'done', outcome: 'answers', prUrl: 'https://github.com/acme/widgets/pull/41' });
    fake.end(p(2), { status: 'running', prUrl: 'https://github.com/acme/widgets/pull/42' });
    await run();
    expect(keeper.asked.at(-1)).toEqual({ installation: 1, repo: 'acme/widgets', branch: BRANCH, features: [{ prd: p(1), pr: parsePr(41) }] });
  });

  it('asks nothing of a mission at with-you, nor of a paused one', async () => {
    const keeper = keeperOf([inStep()]);
    await setup({ mission: record({ level: 'with-you' }), keepUps: keeper.keepUps }).run();
    await setup({ mission: record({ status: 'paused' }), keepUps: keeper.keepUps }).run();
    expect(keeper.asked).toEqual([]);
  });

  it('waits on a person naming the files of a real conflict, and joins nothing while the branch cannot follow', async () => {
    const conflict: KeptUp = { branch: 'conflict', defaultBranch: 'main', title: 'feat(quotes): faster (#45)', generated: false, files: ['kit/lib/a.ts'] };
    const keeper = keeperOf([conflict]);
    const { fake, run, merges } = setup({ keepUps: keeper.keepUps });
    await run();
    fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/41' });
    await run();
    expect(merges).toEqual([]);
    const waiting = fake.mission().waitingOn ?? '';
    expect(waiting).toContain(`${BRANCH} cannot follow main: "feat(quotes): faster (#45)" conflicts with it in kit/lib/a.ts`);
    expect(waiting).toContain(`PRD 1: joins ${BRANCH} once: ${BRANCH} must follow main first`);
    expect(fake.events().some((event) => event.kind === 'waits' && event.sentence.includes('kit/lib/a.ts'))).toBe(true);
    expect(fake.cares()).toEqual([]);
  });

  it('joins once the branch follows again', async () => {
    const conflict: KeptUp = { branch: 'held', defaultBranch: 'main', why: 'it moved while it was being rebased: the next run reads it again' };
    const keeper = keeperOf([inStep(), conflict, inStep()]);
    const { fake, run, merges } = setup({ keepUps: keeper.keepUps });
    await run();
    fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/41' });
    await run();
    expect(merges).toEqual([]);
    await run();
    expect(merges).toEqual([41]);
  });

  it('sends one care job for a feature branch that conflicts only in generated paths, and one again for a new head of the branch', async () => {
    const generated = (since: string) => inStep([{ prd: p(1), pr: parsePr(41), kept: 'conflict', generated: true, files: ['kit/dist/omni.mjs'] }], since);
    const keeper = keeperOf([generated('2027-01-22T08:00:00Z'), generated('2027-01-22T08:00:00Z'), generated('2027-01-22T08:30:00Z')]);
    const { fake, run } = setup({ keepUps: keeper.keepUps });
    await run();
    await run();
    expect(fake.cares()).toEqual([expect.objectContaining({ line: `/omni:pr-care 1 --once --base ${BRANCH}`, toFleet: 'night-shift' })]);
    await run();
    expect(fake.cares().map(({ line }) => line)).toEqual([`/omni:pr-care 1 --once --base ${BRANCH}`, `/omni:pr-care 1 --once --base ${BRANCH}`]);
    // A rebuild is no person's: the mission waits on nobody for it.
    expect(fake.mission().waitingOn ?? '').not.toContain('kit/dist');
  });

  it('names a feature branch whose sources conflict, and sends no job for it', async () => {
    const keeper = keeperOf([inStep([{ prd: p(1), pr: parsePr(41), kept: 'conflict', generated: false, files: ['kit/lib/b.ts'] }])]);
    const { fake, run } = setup({ keepUps: keeper.keepUps });
    await run();
    expect(fake.mission().waitingOn).toContain(`PRD 1: #41 conflicts with ${BRANCH} in kit/lib/b.ts`);
    expect(fake.cares()).toEqual([]);
  });
});
