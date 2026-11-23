import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseIssue, parseOutboxItemId, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { reviewMarker } from 'omni-loop/kit/lib/review/verdict.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { goesOn, itemDecisionOf } from './committee.ts';
import { judge, type PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// The committee approves a mission's PRD at `alone` (PRD 2896 s9, criteria 13, 15 and 16): a PRD waiting for approval goes to
// its fleet's committee instead of a person; its decision is recorded once, as the service; carried, the PRD is built under the
// fleet's approval for this mission; anything else waits for a person with the verdicts. Below `alone` nothing changes.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
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
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'none', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });

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

function setup({ mission = record(), all = [facts(1)] } = {}) {
  const fake = fakeMissionStore({ mission, facts: all });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run };
}

const yes = [
  { role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' },
  { role: 'architect' as const, answer: 'yes' as const, sentence: 'Reversible.' },
  { role: 'reviewer' as const, answer: 'yes' as const, sentence: 'Tested.' },
];
const logOf = (over: Record<string, unknown> = {}) =>
  `12:00:00 Done: ok · 3 verdicts\n${committeeLine({ v: 1, prd: p(1), kind: 'approve', author: null, read: [{ kind: 'spec', sha256: 'a'.repeat(64) }], escalations: [], verdicts: yes, outcome: 'carried', ...over })}`;

describe('at alone, a PRD waiting for approval goes to its committee', () => {
  it('sends /omni:committee to the fleet instead of waiting for a person, and builds nothing yet', async () => {
    const { fake, run } = setup();
    await run();
    expect(fake.committees().map(({ line, key, toFleet }) => [line, key, toFleet])).toEqual([['/omni:committee 1 --approve', `mission:${ID}:prd:1:approve:1`, 'night-shift']]);
    expect(fake.jobs()).toEqual([]);
    expect(fake.mission().status).toBe('running');
    expect(fake.events().filter((event) => event.kind === 'dispatched').map((event) => event.sentence)).toEqual([
      "Sent /omni:committee 1 --approve to the night-shift fleet's runners (round 1).",
    ]);
  });

  it('carries three yes: records the decision once as the service, then builds the PRD under the fleet\'s approval (criterion 13)', async () => {
    const { fake, run } = setup();
    await run();
    fake.endCommittee(p(1), { status: 'done' }, logOf());
    await run();
    const [sent] = fake.committees();
    expect(sent?.recorded).toEqual({ record: { author: null, read: [{ kind: 'spec', sha256: 'a'.repeat(64) }], verdicts: yes }, decision: { outcome: 'carried', why: [] } });
    expect(fake.jobs().map((job) => job.line)).toEqual([`/omni:yolo 1 --for-review --base ${BRANCH}`]);
    expect(fake.events().filter((event) => event.kind === 'decided')).toEqual([
      expect.objectContaining({ role: 'pm', actor: 'agent', prd: p(1), sentence: 'The committee approved PRD 1: pm yes, architect yes, reviewer yes.' }),
    ]);
    await run();
    expect(fake.committees()).toHaveLength(1);
    expect(fake.events().filter((event) => event.kind === 'decided')).toHaveLength(1);
  });

  it('sends a no to a person with the verdict, and builds nothing (criterion 16)', async () => {
    const { fake, run } = setup();
    await run();
    fake.endCommittee(p(1), { status: 'done' }, logOf({ verdicts: [yes[0], { role: 'architect', answer: 'no', sentence: 'It changes a stored shape.' }, yes[2]] }));
    await run();
    expect(fake.jobs()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 1: approve it (the committee sent it to you: the Architect answered no: It changes a stored shape.)' });
    expect(fake.events().filter((event) => event.kind === 'escalated').map((event) => [event.role, event.sentence])).toEqual([
      ['pm', 'PRD 1 goes to a person: the Architect answered no: It changes a stored shape.'],
    ]);
    await run();
    expect(fake.committees()).toHaveLength(1);
  });

  it('AC-5: carries a PRD on the escalation list on three yes, and builds it towards the mission branch (PRD omni-loop-21 s8)', async () => {
    // Before omni-loop-21 the list sent it to a person whatever the members said (PRD 2896 criterion 15); now the members decide it.
    const { fake, run } = setup();
    await run();
    fake.endCommittee(p(1), { status: 'done' }, logOf({ escalations: ['it bears on the locked law N-PRODUCT-15: its owner decides'] }));
    await run();
    expect(fake.committees()[0]?.recorded?.decision).toEqual({ outcome: 'carried', why: [] });
    expect(fake.jobs().map((job) => job.line)).toEqual([`/omni:yolo 1 --for-review --base ${BRANCH}`]);
    expect(fake.mission().status).toBe('running');
  });

  it('sends a person a PRD on the escalation list the vote did not carry, the case named first', async () => {
    const { fake, run } = setup();
    await run();
    const verdicts = [yes[0], { role: 'architect', answer: 'no', sentence: 'It drops a column.' }, yes[2]];
    fake.endCommittee(p(1), { status: 'done' }, logOf({ escalations: ['the migration x.sql drops or rewrites data'], verdicts }));
    await run();
    expect(fake.jobs()).toEqual([]);
    expect(fake.committees()[0]?.recorded?.decision.why).toEqual(['on the escalation list: the migration x.sql drops or rewrites data', 'the Architect answered no: It drops a column.']);
  });

  it('sends a person a PRD approved by its phase-0 pull request, although three members answered yes (N-PRODUCT-15)', async () => {
    const phase0 = 'it is approved by its phase-0 pull request, which only a person merges';
    const { fake, run } = setup();
    await run();
    fake.endCommittee(p(1), { status: 'done' }, logOf({ escalations: [phase0] }));
    await run();
    expect(fake.jobs()).toEqual([]);
    expect(fake.committees()[0]?.recorded?.decision).toEqual({ outcome: 'escalated', why: [phase0] });
  });

  it('sends a person what the database escalates itself, as a phase-0 PRD', async () => {
    const { fake, run } = setup();
    fake.database(() => ({ outcome: 'escalated', why: ['it is approved by its phase-0 pull request, which only a person merges'] }));
    await run();
    fake.endCommittee(p(1), { status: 'done' }, logOf());
    await run();
    expect(fake.jobs()).toEqual([]);
    expect(fake.mission().waitingOn).toContain('phase-0 pull request');
  });

  it('escalates a committee job that failed, each member counted failed (criterion 16)', async () => {
    const { fake, run } = setup();
    await run();
    fake.endCommittee(p(1), { status: 'failed', reason: 'exit code 1' });
    await run();
    expect(fake.committees()[0]?.recorded?.record.verdicts.map((v) => v.answer)).toEqual(['failed', 'failed', 'failed']);
    expect(fake.jobs()).toEqual([]);
  });

  it('sends the committee again when a push voided the fleet\'s approval', async () => {
    const { fake, run } = setup();
    await run();
    fake.endCommittee(p(1), { status: 'done' }, logOf());
    fake.set(p(1), { approval: 'standing' });
    await run();
    // The build was held, and a push voided the fleet's approval meanwhile: run 2 goes to the committee first, round 2.
    fake.end(p(1), { status: 'done', outcome: 'held' });
    fake.set(p(1), { approval: 'voided' });
    await run();
    expect(fake.committees().map(({ key }) => key)).toEqual([`mission:${ID}:prd:1:approve:1`, `mission:${ID}:prd:1:approve:2`]);
    expect(fake.jobs()).toHaveLength(1);
  });
});

describe('AC-5: the meeting decides a high item on the escalation list, and the PRD goes on (PRD omni-loop-21 s8)', () => {
  const ITEM = 's2-01-keep-the-cap';
  const law = 'it bears on the business law BL-QUOTES-1: a person decides';
  const answerLog = (over: Record<string, unknown> = {}) =>
    `12:00:00 Done: ok\n${committeeLine({ v: 1, prd: p(1), kind: 'answer', item: parseOutboxItemId(ITEM), option: 'A', author: null, read: [{ kind: 'item', sha256: 'b'.repeat(64) }], escalations: [law], verdicts: yes, outcome: 'carried', ...over })}`;
  /** The PRD's feature pull request into the mission branch, green and passed, the item open at its head. */
  const pullWith = (base = BRANCH): PullRead => ({
    number: 45,
    url: 'https://github.com/acme/widgets/pull/45',
    title: 'feat(quotes): a faster quote page',
    state: 'open',
    draft: false,
    merged: false,
    base,
    defaultBranch: 'main',
    head: 'a'.repeat(40),
    runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
    statuses: [],
    reviews: [{ body: `${reviewMarker(1, 'pass')}\n**Round 1 of 2: pass**`, commit: 'a'.repeat(40) }],
    items: { ranks: ['high'], open: [{ id: ITEM, rank: 'high' }] },
  });

  /** The item's committee decided, recorded once as the database keeps it, and what the merge gate then says of its PRD. */
  async function decideAndJudge(log: string, base = BRANCH) {
    const { fake } = setup();
    const { verdicts, decision } = itemDecisionOf(p(1), { item: ITEM, attempt: { status: 'done' } }, log);
    const kept = await fake.store.decideItem(record(), { prd: p(1), item: ITEM, job: 'job-ask-1', verdicts, decision });
    const answered = new Set(goesOn(kept) ? [ITEM] : []);
    return { kept, decisions: await fake.store.decisions(ID), gate: judge(pullWith(base), BRANCH, answered) };
  }

  it('AC-5: records the item as decided by the fleet, on the escalation list, on every yes, and the PRD joins the mission branch', async () => {
    const { kept, decisions, gate } = await decideAndJudge(answerLog());
    expect(kept).toEqual({ outcome: 'carried', why: [`on the escalation list: ${law}`], option: null });
    expect(decisions).toEqual([expect.objectContaining({ kind: 'answer', prd: p(1), item: ITEM, outcome: 'carried', why: [`on the escalation list: ${law}`] })]);
    expect(gate).toEqual({ decision: 'merge' });
  });

  it('AC-5: records the most reversible option as deferred when a member answers no, and the PRD still joins', async () => {
    const verdicts = [yes[0], { role: 'architect', answer: 'no', sentence: 'It changes the quote total.' }, yes[2]];
    const { kept, decisions, gate } = await decideAndJudge(answerLog({ verdicts, outcome: 'deferred' }));
    expect(kept).toEqual({ outcome: 'deferred', why: [`on the escalation list: ${law}`, 'the Architect answered no: It changes the quote total.'], option: 'A' });
    expect(decisions[0]).toMatchObject({ outcome: 'deferred', option: 'A' });
    expect(gate).toEqual({ decision: 'merge' });
  });

  it('keeps the item open for a person when its committee failed: the PRD waits', async () => {
    const { kept, gate } = await decideAndJudge('no record here');
    expect(kept.outcome).toBe('escalated');
    expect(gate).toEqual({ decision: 'waits', lacks: ['1 high item open'] });
  });

  it('never lets the fleet\'s answer carry a pull request into the default branch (BR-PRODUCT-145)', async () => {
    const { kept, gate } = await decideAndJudge(answerLog(), 'main');
    expect(kept.outcome).toBe('carried');
    expect(gate).toEqual({ decision: 'waits', lacks: [`#45 targets main, not ${BRANCH}`] });
  });
});

describe('below alone nothing changes', () => {
  it('waits for a person to approve, and sends no committee (criterion 2)', async () => {
    for (const level of ['with-you', 'own-branch'] as const) {
      const { fake, run } = setup({ mission: record({ level }) });
      await run();
      expect(fake.committees()).toEqual([]);
      expect(fake.jobs()).toEqual([]);
      expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 1: approve it' });
    }
  });

  it('builds a PRD a person approved without its committee, at alone too', async () => {
    const { fake, run } = setup({ all: [facts(1, { approval: 'standing' })] });
    await run();
    expect(fake.committees()).toEqual([]);
    expect(fake.jobs().map((job) => job.line)).toEqual([`/omni:yolo 1 --for-review --base ${BRANCH}`]);
  });
});
