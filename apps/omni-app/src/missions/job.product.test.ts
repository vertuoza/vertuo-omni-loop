import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseIssue, parseOutboxItemId, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler, type MissionDeps } from './job.ts';
import type { MissionJoins } from './join.ts';
import type { MissionAnswers } from './settle.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// The mission run wires what PRD omni-loop-21's slices built (s9b): the resume step (s10), the members' item decisions (s8), the
// Engineer's outside bugs (s11) and the product PRDs of a scope (s7), each driven through the real job handler with the fake store.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
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

function setup({ mission = record(), all = [facts(1)], deps = {} }: { mission?: MissionRecord; all?: PrdFacts[]; deps?: Partial<MissionDeps> } = {}) {
  const fake = fakeMissionStore({ mission, facts: all });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined, ...deps })(claimed);
  const sentences = (kind: string) => fake.events().filter((event) => event.kind === kind).map((event) => event.sentence);
  return { fake, run, sentences };
}

// ── The resume step (s10, item s10-01) ──────────────────────────────────────────

describe('a step that ended without its result line, in the run (AC-6)', () => {
  it('AC-6: sends the build again under :resume:1 at alone, and says so, the run and the step unchanged', async () => {
    const { fake, run, sentences } = setup();
    await run();
    fake.end(p(1), { status: 'done', outcome: null });
    await run();
    expect(fake.jobs().map(({ key, resume }) => [key, resume])).toEqual([
      [`mission:${ID}:prd:1:run:1`, 0],
      [`mission:${ID}:prd:1:run:1:resume:1`, 1],
    ]);
    expect(sentences('held')).toEqual(['PRD 1 ended without its result line: the mission sends it a fresh job (resume 1 of 3).']);
    expect(sentences('dispatched').at(-1)).toBe("Sent /omni:yolo 1 --for-review --base mission/12-faster-quotes to the night-shift fleet's runners (run 1, resume 1).");
    await run();
    expect(fake.jobs()).toHaveLength(2);
  });

  it('AC-6: sends a repair once a step ended halfway more than mandate.resumes times', async () => {
    const { fake, run, sentences } = setup({ mission: record({ resumes: 1 }) });
    await run();
    fake.end(p(1), { status: 'done', outcome: null });
    await run();
    fake.end(p(1), { status: 'done', outcome: null });
    await run();
    expect(fake.jobs()).toHaveLength(2);
    expect(fake.repairJobs().map(({ key }) => key)).toEqual([`mission:${ID}:prd:1:repair:1`]);
    expect(sentences('held').at(-1)).toBe('PRD 1 ended without its result line 2 times: the mission sends a repair, while it has one left.');
  });

  it('AC-6: below alone, a step that stopped mid-way is sent again once as run 2, as before', async () => {
    const { fake, run } = setup({ mission: record({ level: 'with-you' }) });
    await run();
    fake.end(p(1), { status: 'done', outcome: null });
    await run();
    expect(fake.jobs().map(({ key }) => key)).toEqual([`mission:${ID}:prd:1:run:1`, `mission:${ID}:prd:1:run:2`]);
  });
});

// ── The members decide an item (s8, item s8-01) ─────────────────────────────────

const BRANCH = 'mission/12-faster-quotes';
const ITEM = 's3-01-keep-the-cap';
const PR_URL = 'https://github.com/acme/widgets/pull/31';
type Open = { id: string | null; rank: string | null }[];

const pullOf = (open: Open): PullRead => ({
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

const yes = [
  { role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' },
  { role: 'architect' as const, answer: 'yes' as const, sentence: 'Reversible.' },
  { role: 'reviewer' as const, answer: 'yes' as const, sentence: 'Tested.' },
];
const answerLog = (over: Record<string, unknown> = {}) =>
  `12:00:00 Done: ok\n${committeeLine({ v: 1, prd: p(1), kind: 'answer', item: parseOutboxItemId(ITEM), option: 'A', author: null, read: [{ kind: 'item', sha256: 'a'.repeat(64) }], escalations: [], verdicts: yes, outcome: 'carried', ...over })}`;

function itemSetup() {
  const state = { open: [{ id: ITEM, rank: 'high' }] as Open, settled: [] as Parameters<MissionAnswers['settle']>[0][] };
  const joins: MissionJoins = { read: () => Promise.resolve(pullOf(state.open)), merge: () => Promise.resolve({ ok: true }) };
  const answers: MissionAnswers = {
    settle: (at) => {
      state.settled.push(at);
      state.open = state.open.filter((one) => one.id !== at.item);
      return Promise.resolve({ ok: true, settled: true });
    },
  };
  const made = setup({ mission: record({ hardToRevert: 0.5 }), deps: { joins, answers } });
  /** The build ran, ended Waiting on answers, and its item went to the members. */
  const asked = async () => {
    await made.run();
    made.fake.end(p(1), { status: 'done', outcome: 'answers', prUrl: PR_URL });
    await made.run();
  };
  return { ...made, state, asked };
}

describe('an escalation-list item, decided by the members in the run (AC-5)', () => {
  it('AC-5: defers an item on a no, with option A and a real why, settles it and carries the PRD on', async () => {
    const { fake, run, state, sentences, asked } = itemSetup();
    await asked();
    fake.endAsk(ITEM, { status: 'done' }, answerLog({ verdicts: [yes[0], { role: 'architect', answer: 'no', sentence: 'B is safer.' }, yes[2]] }));
    await run();
    expect(state.settled.map(({ item, answer }) => [item, answer.option, answer.branch])).toEqual([[ITEM, 'A', BRANCH]]);
    const decided = await fake.store.decisions(ID);
    expect(decided.map(({ kind, item, outcome, option }) => [kind, item, outcome, option])).toEqual([['answer', ITEM, 'deferred', 'A']]);
    expect(decided[0]?.why.length).toBeGreaterThan(0);
    expect(sentences('deferred')).toHaveLength(1);
    expect(sentences('deferred')[0]).toMatch(new RegExp(`^The committee deferred ${ITEM} of PRD 1: option A meanwhile, open for a person on the mission pull request \\(.+\\)\\.$`));
    expect(sentences('escalated')).toEqual([]);
    await run();
    expect(fake.jobs().map(({ key }) => key)).toEqual([`mission:${ID}:prd:1:run:1`, `mission:${ID}:prd:1:run:2`]);
  });

  it('AC-5: carries an item on the escalation list when every sitting member answered yes', async () => {
    const { fake, run, state, sentences, asked } = itemSetup();
    await asked();
    fake.endAsk(ITEM, { status: 'done' }, answerLog({ escalations: ['its hard-to-revert score is unknown'] }));
    await run();
    expect(state.settled).toHaveLength(1);
    expect((await fake.store.decisions(ID)).map(({ outcome, option }) => [outcome, option])).toEqual([['carried', null]]);
    expect(sentences('decided')).toHaveLength(1);
    await run();
    expect(sentences('decided')).toHaveLength(1);
  });

  it('AC-5: a failed member job goes to a person, recorded once, settled nowhere', async () => {
    const { fake, run, state, sentences, asked } = itemSetup();
    await asked();
    fake.endAsk(ITEM, { status: 'failed', reason: 'boom' });
    await run();
    expect(state.settled).toEqual([]);
    expect((await fake.store.decisions(ID)).map(({ outcome }) => outcome)).toEqual(['escalated']);
    expect(sentences('escalated')).toHaveLength(1);
  });
});
