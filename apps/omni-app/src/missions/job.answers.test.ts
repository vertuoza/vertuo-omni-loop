import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseIssue, parseOutboxItemId, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins } from './join.ts';
import type { MissionAnswers, Settled } from './settle.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// The committee answers a high item at `alone` (PRD 2896 s10, criteria 14 to 16): a PRD whose build ended Waiting on answers sends
// each high item open at its head to its fleet's committee; carried, the App settles it on the feature branch as answered by the
// fleet, and once none is open the PRD's run is sent again. Since PRD omni-loop-21 s8, the members decide an escalation-list
// item in the run too, and a no defers it with option A, its why attached, open for a person on the mission pull request.
// Below `alone`, nothing changes.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
const ITEM = 's3-01-keep-the-cap';
const PR_URL = 'https://github.com/acme/widgets/pull/31';
const p = (n: number): PrdNumber => parsePrd(n);

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 1,
  scope: { prds: [p(1)], roadmaps: [] },
  hardToRevert: 0.5,
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

const pull = (open: { id: string | null; rank: string | null }[]): PullRead => ({
  number: 31,
  url: PR_URL,
  title: 'PRD 1',
  state: 'open',
  draft: true,
  merged: false,
  base: BRANCH,
  defaultBranch: 'main',
  head: 'abc',
  runs: [],
  statuses: [],
  reviews: [],
  items: { ranks: open.map(({ rank }) => rank), open },
});

type Open = { id: string | null; rank: string | null }[];

function setup({ mission = record(), open = [{ id: ITEM, rank: 'high' }], settles = { ok: true, settled: true } }: { mission?: MissionRecord; open?: Open; settles?: Settled } = {}) {
  const fake = fakeMissionStore({ mission, facts: [facts(1)] });
  const state = { open, settled: [] as Parameters<MissionAnswers['settle']>[0][] };
  const joins: MissionJoins = { read: () => Promise.resolve(pull(state.open)), merge: () => Promise.resolve({ ok: true }) };
  const answers: MissionAnswers = {
    settle: (at) => {
      state.settled.push(at);
      if (settles.ok) state.open = state.open.filter((one) => one.id !== at.item);
      return Promise.resolve(settles);
    },
  };
  const run = () => missionHandler({ store: fake.store, branches, joins, answers, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  /** The build ran and ended Waiting on answers, its feature pull request named. */
  const builtWaitingOnAnswers = async () => {
    await run();
    fake.end(p(1), { status: 'done', outcome: 'answers', prUrl: PR_URL });
  };
  return { fake, run, state, builtWaitingOnAnswers };
}

const yes = [
  { role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' },
  { role: 'architect' as const, answer: 'yes' as const, sentence: 'Reversible.' },
  { role: 'reviewer' as const, answer: 'yes' as const, sentence: 'Tested.' },
];
const logOf = (over: Record<string, unknown> = {}) =>
  `12:00:00 Done: ok\n${committeeLine({ v: 1, prd: p(1), kind: 'answer', item: parseOutboxItemId(ITEM), option: 'A', author: null, read: [{ kind: 'item', sha256: 'a'.repeat(64) }], escalations: [], verdicts: yes, outcome: 'carried', ...over })}`;

describe('at alone, a high item goes to the committee', () => {
  it('sends /omni:committee --item for each high item open at the head, with the mission\'s bound, and nothing else', async () => {
    const { fake, run, builtWaitingOnAnswers } = setup();
    await builtWaitingOnAnswers();
    await run();
    expect(fake.asks().map(({ line, toFleet }) => [line, toFleet])).toEqual([[`/omni:committee 1 --item ${ITEM} --bound 0.5`, 'night-shift']]);
    expect(fake.jobs()).toHaveLength(1);
    expect(fake.mission().status).toBe('running');
    await run();
    expect(fake.asks()).toHaveLength(1);
  });

  it('settles a carried answer on the feature branch as the fleet, then sends the run again (criterion 14)', async () => {
    const { fake, run, state, builtWaitingOnAnswers } = setup();
    await builtWaitingOnAnswers();
    await run();
    fake.endAsk(ITEM, { status: 'done' }, logOf());
    await run();
    expect(state.settled).toEqual([
      { installation: 1, repo: 'acme/widgets', prd: p(1), pr: 31, item: ITEM, answer: { fleet: 'night-shift', option: 'A', branch: BRANCH, at: new Date(NOW).toISOString(), verdicts: yes } },
    ]);
    expect(fake.events().filter((event) => event.kind === 'decided').map(({ role, actor, sentence }) => [role, actor, sentence])).toEqual([
      ['pm', 'agent', `The committee answered ${ITEM} of PRD 1 with option A: pm yes, architect yes, reviewer yes.`],
    ]);
    expect(fake.jobs().map(({ line, run: n }) => [line, n])).toEqual([
      [`/omni:yolo 1 --for-review --base ${BRANCH}`, 1],
      [`/omni:yolo 1 --for-review --base ${BRANCH}`, 2],
    ]);
    await run();
    expect(state.settled).toHaveLength(1);
    expect(fake.events().filter((event) => event.kind === 'decided')).toHaveLength(1);
  });

  it('defers an item a member answered no to, with option A and the verdict as its why (criterion 16, as PRD omni-loop-21 s8 reads it)', async () => {
    const { fake, run, state, builtWaitingOnAnswers } = setup();
    await builtWaitingOnAnswers();
    await run();
    fake.endAsk(ITEM, { status: 'done' }, logOf({ verdicts: [yes[0], { role: 'architect', answer: 'no', sentence: 'B is safer.' }, yes[2]] }));
    await run();
    expect(state.settled.map(({ item, answer }) => [item, answer.option])).toEqual([[ITEM, 'A']]);
    expect(fake.events().filter((event) => event.kind === 'deferred').map((event) => event.sentence)).toEqual([
      `The committee deferred ${ITEM} of PRD 1: option A meanwhile, open for a person on the mission pull request (the Architect answered no: B is safer.).`,
    ]);
    expect(fake.events().filter((event) => event.kind === 'escalated')).toEqual([]);
  });

  it('decides an item the list named in the run: three yes carry it (criterion 15, as PRD omni-loop-21 s8 reads it)', async () => {
    const { fake, run, state, builtWaitingOnAnswers } = setup();
    await builtWaitingOnAnswers();
    await run();
    fake.endAsk(ITEM, { status: 'done' }, logOf({ escalations: ['its hard-to-revert score is unknown'] }));
    await run();
    expect(state.settled.map(({ item, answer }) => [item, answer.option])).toEqual([[ITEM, 'A']]);
    expect(fake.events().filter((event) => event.kind === 'decided').map((event) => event.sentence)).toEqual([`The committee answered ${ITEM} of PRD 1 with option A: pm yes, architect yes, reviewer yes.`]);
    expect(fake.events().filter((event) => event.kind === 'escalated')).toEqual([]);
  });

  it('sends a person an answer GitHub would not let the App settle, with its reason', async () => {
    const { fake, run, builtWaitingOnAnswers } = setup({ settles: { ok: false, why: '#31 targets main, the default branch: a person answers its items' } });
    await builtWaitingOnAnswers();
    await run();
    fake.endAsk(ITEM, { status: 'done' }, logOf());
    await run();
    expect(fake.events().find((event) => event.kind === 'escalated')?.sentence).toBe(`${ITEM} of PRD 1 goes to a person: #31 targets main, the default branch: a person answers its items`);
    expect(fake.jobs()).toHaveLength(1);
  });

  it('never sends a human-action item: it waits for a person', async () => {
    const { fake, run, builtWaitingOnAnswers } = setup({ open: [{ id: 's3-02-set-the-key', rank: 'human-action' }] });
    await builtWaitingOnAnswers();
    await run();
    expect(fake.asks()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 1: answer its questions (s3-02-set-the-key is a human-action item: only a person can act on it)' });
  });
});

describe('below alone', () => {
  it('sends no committee: a PRD waiting on answers waits for a person, as before', async () => {
    const { fake, run, builtWaitingOnAnswers } = setup({ mission: record({ level: 'own-branch' }) });
    await builtWaitingOnAnswers();
    await run();
    expect(fake.asks()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 1: answer its questions' });
  });
});
