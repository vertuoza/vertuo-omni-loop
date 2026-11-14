import { describe, expect, it } from 'vitest';
import { parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import {
  approvalOf,
  conclude,
  endOf,
  eventsOf,
  expandScope,
  missionKey,
  outcome,
  pick,
  prdStates,
  recordedKeys,
  runOfKey,
  stageOf,
  territoryOf,
  type Attempt,
  type Mission,
  type PrdFacts,
  type Run,
} from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const p = (n: number): PrdNumber => parsePrd(n);

const mission = (over: Partial<Mission> = {}): Mission => ({ id: ID, fleet: 'night-shift', status: 'running', parallel: 2, waitingOn: null, ...over });
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });
const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'running', outcome: null, reason: null, prUrl: null, ...over });
const run = (n: number, k: number, ...attempts: Attempt[]): Run => ({ prd: p(n), run: k, job: attempts[0]?.id ?? `job-${String(n)}-${String(k)}`, attempts });
const ended = (id: string, outcomeWord: string | null, over: Partial<Attempt> = {}) => attempt(id, { status: 'done', outcome: outcomeWord, ...over });

/** The PRDs a run sends, as numbers. */
const sends = (m: Mission, all: PrdFacts[], runs: Run[] = []) => pick({ mission: m, facts: all, states: prdStates(all, runs) }).map(({ prd, run: k }) => [Number(prd), k]);

describe('the mission key: one per PRD and run, never twice', () => {
  it('reads mission:<id>:prd:<n>:run:<k>, and back', () => {
    expect(missionKey(ID, p(2803), 1)).toBe(`mission:${ID}:prd:2803:run:1`);
    expect(runOfKey(`mission:${ID}:prd:2803:run:2`)).toEqual({ prd: 2803, run: 2 });
    expect(runOfKey('mission:nope')).toBeNull();
  });
});

describe('the reads, made plain', () => {
  it('an approval stands only while no push voided it', () => {
    expect(approvalOf(null)).toBe('none');
    expect(approvalOf({ voided: false })).toBe('standing');
    expect(approvalOf({ voided: true })).toBe('voided');
  });

  it('a PRD shipped or at its retro is merged; at outbox, ready; else open', () => {
    expect(stageOf(['prd', 'inbox', 'building', 'outbox', 'shipped'])).toBe('merged');
    expect(stageOf(['retro'])).toBe('merged');
    expect(stageOf(['inbox', 'building', 'outbox'])).toBe('ready');
    expect(stageOf(['inbox', 'building'])).toBe('open');
    expect(stageOf([])).toBe('open');
  });

  it('a plan\'s territory is every slice\'s, with the kit\'s parser; no plan, or one it cannot read, is none', () => {
    const plan = ['| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | a | `apps/a/` `kit/lib/a.` | — | 1 |', '| s2 | b | `apps/a/` `docs/b.md` | s1 | 2 |'].join('\n');
    expect(territoryOf(plan)).toEqual(['apps/a/', 'kit/lib/a.', 'docs/b.md']);
    expect(territoryOf(null)).toBeNull();
    expect(territoryOf('# A plan with no slice table')).toBeNull();
  });

  it('a roadmap expands into its PRDs, each blocker row read as its PRD, after the PRDs named alone', () => {
    const scope = expandScope([p(2803)], [
      [
        { prd: p(2810), rowId: 'P1', blockers: [] },
        { prd: p(2811), rowId: 'P2', blockers: ['P1'] },
        { prd: null, rowId: 'P3', blockers: ['P2'] },
        { prd: p(2803), rowId: 'P4', blockers: ['P1'] },
      ],
    ]);
    expect(scope).toEqual([
      { prd: 2803, blockers: [2810] },
      { prd: 2810, blockers: [] },
      { prd: 2811, blockers: [2810] },
    ]);
  });
});

describe('outcome: the spec\'s table, a job\'s end to the mission\'s next step', () => {
  it('maps each end', () => {
    expect(outcome('ready', 1)).toEqual({ next: 'waits', on: 'merge' });
    expect(outcome('answers', 1)).toEqual({ next: 'waits', on: 'answer' });
    expect(outcome('human', 1)).toEqual({ next: 'waits', on: 'act' });
    expect(outcome('held', 1)).toEqual({ next: 'again' });
    expect(outcome('stopped', 1)).toEqual({ next: 'again' });
    expect(outcome('held', 2)).toEqual({ next: 'stops', why: 'it was held twice' });
    expect(outcome('stopped', 2)).toEqual({ next: 'stops', why: 'it stopped mid-way twice' });
    expect(outcome('lost', 1)).toEqual({ next: 'records' });
    expect(outcome('cancelled', 1)).toEqual({ next: 'paused' });
    expect(outcome('failed', 1, 'timeout')).toEqual({ next: 'stops', why: 'its job failed: timeout' });
    expect(outcome('failed', 1, null)).toEqual({ next: 'stops', why: 'its job failed' });
  });

  it('reads a runner job\'s end from its status and outcome', () => {
    expect(endOf(attempt('j', { status: 'queued' }))).toBeNull();
    expect(endOf(attempt('j', { status: 'claimed' }))).toBeNull();
    expect(endOf(attempt('j'))).toBeNull();
    expect(endOf(ended('j', 'ready'))).toBe('ready');
    expect(endOf(ended('j', 'answers'))).toBe('answers');
    expect(endOf(ended('j', 'human'))).toBe('human');
    expect(endOf(ended('j', 'held'))).toBe('held');
    expect(endOf(ended('j', 'stopped'))).toBe('stopped');
    expect(endOf(ended('j', null))).toBe('stopped');
    expect(endOf(attempt('j', { status: 'cancelled' }))).toBe('cancelled');
    expect(endOf(attempt('j', { status: 'failed', reason: 'runner lost' }))).toBe('failed');
  });
});

describe('pick: the PRDs a run sends', () => {
  it('sends every startable PRD at once, up to the mandate', () => {
    expect(sends(mission(), [facts(1), facts(2), facts(3)])).toEqual([[1, 1], [2, 1]]);
    expect(sends(mission({ parallel: 4 }), [facts(1), facts(2), facts(3)])).toEqual([[1, 1], [2, 1], [3, 1]]);
  });

  it('counts the PRDs already running against the mandate', () => {
    expect(sends(mission(), [facts(1), facts(2), facts(3)], [run(1, 1, attempt('a'))])).toEqual([[2, 1]]);
    expect(sends(mission(), [facts(1), facts(2), facts(3)], [run(1, 1, attempt('a')), run(2, 1, attempt('b', { status: 'queued' }))])).toEqual([]);
  });

  it('sends no PRD without a standing approval: none yet, or voided by a changed file', () => {
    expect(sends(mission(), [facts(1, { approval: 'none' }), facts(2, { approval: 'voided' }), facts(3)])).toEqual([[3, 1]]);
  });

  it('sends no PRD before every blocker is merged', () => {
    expect(sends(mission(), [facts(1), facts(2, { blockers: [p(1)] })])).toEqual([[1, 1]]);
    expect(sends(mission(), [facts(1, { stage: 'merged' }), facts(2, { blockers: [p(1)] })])).toEqual([[2, 1]]);
    expect(sends(mission(), [facts(2, { blockers: [p(99)] })])).toEqual([]);
  });

  it('sends no PRD whose plan meets a running PRD\'s territory, nor two that meet each other', () => {
    const shared = ['apps/shared/'];
    expect(sends(mission(), [facts(1, { territory: shared }), facts(2, { territory: ['apps/shared/page.ts'] }), facts(3)])).toEqual([[1, 1], [3, 1]]);
    expect(sends(mission(), [facts(1, { territory: shared }), facts(2, { territory: ['apps/shared/x.'] })], [run(1, 1, attempt('a'))])).toEqual([]);
  });

  it('runs a PRD with no plan alone: only when nothing runs, and then nothing beside it', () => {
    expect(sends(mission(), [facts(1, { territory: null }), facts(2)])).toEqual([[1, 1]]);
    expect(sends(mission(), [facts(1), facts(2, { territory: null }), facts(3)])).toEqual([[1, 1], [3, 1]]);
    expect(sends(mission(), [facts(1, { territory: null }), facts(2)], [run(1, 1, attempt('a'))])).toEqual([]);
    expect(sends(mission({ parallel: 4 }), [facts(2), facts(3, { territory: null })], [run(2, 1, attempt('b'))])).toEqual([]);
  });

  it('sends nothing while paused, a draft or delivered', () => {
    for (const status of ['paused', 'draft', 'delivered'] as const) expect(sends(mission({ status }), [facts(1)])).toEqual([]);
  });

  it('sends a held or stopped-mid-way PRD again, once, as run 2; never a third time', () => {
    expect(sends(mission(), [facts(1)], [run(1, 1, ended('a', 'held'))])).toEqual([[1, 2]]);
    expect(sends(mission(), [facts(1)], [run(1, 1, ended('a', 'stopped'))])).toEqual([[1, 2]]);
    expect(sends(mission(), [facts(1)], [run(1, 1, ended('a', 'held')), run(1, 2, ended('b', 'held'))])).toEqual([]);
  });

  it('never sends a cancelled PRD again, nor one that failed, nor one that waits on a person', () => {
    expect(sends(mission(), [facts(1)], [run(1, 1, attempt('a', { status: 'cancelled' }))])).toEqual([]);
    expect(sends(mission(), [facts(1)], [run(1, 1, attempt('a', { status: 'failed', reason: 'timeout' }))])).toEqual([]);
    expect(sends(mission(), [facts(1), facts(2)], [run(1, 1, ended('a', 'ready')), run(2, 1, ended('b', 'answers'))])).toEqual([]);
  });

  it('a lost job is its resume\'s: it runs while the resume does', () => {
    expect(sends(mission({ parallel: 1 }), [facts(1), facts(2)], [run(1, 1, attempt('a', { status: 'failed', reason: 'runner lost' }), attempt('a2', { status: 'queued' }))])).toEqual([]);
  });

  it('checks the approval again before sending a held PRD again', () => {
    expect(sends(mission(), [facts(1, { approval: 'voided' })], [run(1, 1, ended('a', 'held'))])).toEqual([]);
  });
});

describe('conclude: the mission\'s status, what it waits on, and its next wake', () => {
  const next = (m: Mission, all: PrdFacts[], runs: Run[] = [], sent = 0) => conclude({ mission: m, facts: all, states: prdStates(all, runs), sent, now: NOW });

  it('runs while a PRD runs or was just sent, waking a minute on', () => {
    expect(next(mission(), [facts(1)], [], 1)).toEqual({ status: 'running', waitingOn: null, nextWakeAt: '2027-01-22T09:01:00.000Z' });
  });

  it('waits on a person, naming each PRD and what it waits on', () => {
    const all = [facts(1), facts(2, { approval: 'voided' }), facts(3, { approval: 'none' }), facts(4)];
    const runs = [run(1, 1, ended('a', 'ready')), run(4, 1, ended('d', 'answers'))];
    expect(next(mission(), all, runs)).toEqual({
      status: 'waiting',
      waitingOn: 'PRD 1: merge it · PRD 2: approve it again · PRD 3: approve it · PRD 4: answer its questions',
      nextWakeAt: '2027-01-22T09:01:00.000Z',
    });
  });

  it('keeps naming who waits while other PRDs run', () => {
    expect(next(mission(), [facts(1), facts(2)], [run(1, 1, ended('a', 'ready')), run(2, 1, attempt('b'))])).toMatchObject({ status: 'running', waitingOn: 'PRD 1: merge it' });
  });

  it('reads Delivered only when every PRD of its scope is merged', () => {
    expect(next(mission(), [facts(1, { stage: 'merged' }), facts(2, { stage: 'ready' })])).toMatchObject({ status: 'waiting' });
    expect(next(mission(), [facts(1, { stage: 'merged' }), facts(2, { stage: 'merged' })])).toEqual({ status: 'delivered', waitingOn: null, nextWakeAt: null });
  });

  it('stops when nothing can move and nobody is waited on, saying why and how to carry on', () => {
    const result = next(mission(), [facts(1), facts(2, { blockers: [p(1)] })], [run(1, 1, attempt('a', { status: 'failed', reason: 'timeout' }))]);
    expect(result.status).toBe('stopped');
    expect(result.nextWakeAt).toBeNull();
    expect(result.waitingOn).toBe('PRD 1 stopped: its job failed: timeout. Take it to ready by hand and the mission carries on.');
  });

  it('stays paused, and wakes on no clock of its own', () => {
    expect(next(mission({ status: 'paused' }), [facts(1)], [run(1, 1, attempt('a'))])).toEqual({ status: 'paused', waitingOn: null, nextWakeAt: null });
  });

  it('a draft stays a draft', () => {
    expect(next(mission({ status: 'draft' }), [facts(1)])).toEqual({ status: 'draft', waitingOn: null, nextWakeAt: null });
  });

  it('keeps what it waits on within 300 characters', () => {
    const many = Array.from({ length: 40 }, (_, n) => facts(1000 + n, { approval: 'voided' }));
    const { waitingOn } = next(mission(), many);
    expect(waitingOn?.length).toBeLessThanOrEqual(300);
    expect(waitingOn?.endsWith('…')).toBe(true);
  });
});

describe('eventsOf: each decision recorded once, signed by its role', () => {
  const events = (input: { m?: Mission; all: PrdFacts[]; runs?: Run[]; recorded?: { kind: string; prd: number | null; job: string | null }[]; toFleet?: boolean }) => {
    const m = input.m ?? mission();
    const runs = input.runs ?? [];
    const states = prdStates(input.all, runs);
    const next = conclude({ mission: m, facts: input.all, states, sent: 0, now: NOW });
    return eventsOf({ mission: m, facts: input.all, states, runs, next, toFleet: input.toFleet ?? true, recorded: recordedKeys((input.recorded ?? []).map((e) => ({ ...e, prd: e.prd === null ? null : p(e.prd) }))) });
  };

  it('records a dispatch per job sent, by the supervisor, as an agent', () => {
    expect(events({ all: [facts(1)], runs: [run(1, 1, attempt('a', { status: 'queued' }))] })).toEqual([
      { kind: 'dispatched', role: 'supervisor', prd: 1, job: 'a', link: null, sentence: 'Sent /omni:yolo 1 to the night-shift fleet\'s runners (run 1).' },
    ]);
    expect(events({ all: [facts(1)], runs: [run(1, 1, attempt('a', { status: 'queued' }))], toFleet: false })[0]?.sentence).toBe('Sent /omni:yolo 1 to any runner of the workspace (run 1).');
  });

  it('records nothing twice: a replayed run finds its events', () => {
    const runs = [run(1, 1, ended('a', 'ready', { prUrl: 'https://github.com/acme/widgets/pull/9' }))];
    const first = events({ all: [facts(1)], runs });
    expect(first.map((e) => e.kind)).toEqual(['dispatched', 'prd-ready', 'waits']);
    expect(first[1]).toEqual({ kind: 'prd-ready', role: 'engineer', prd: 1, job: 'a', link: 'https://github.com/acme/widgets/pull/9', sentence: 'PRD 1 is ready for review: it waits for a person to merge it.' });
    const again = events({ m: mission({ status: 'waiting', waitingOn: 'PRD 1: merge it' }), all: [facts(1)], runs, recorded: first.map(({ kind, prd, job }) => ({ kind, prd, job })) });
    expect(again).toEqual([]);
  });

  it('records a lost runner, and the resume carrying the work', () => {
    const runs = [run(1, 1, attempt('a', { status: 'failed', reason: 'runner lost' }), attempt('a2'))];
    expect(events({ all: [facts(1)], runs, recorded: [{ kind: 'dispatched', prd: 1, job: 'a' }] })).toEqual([
      { kind: 'job-ended', role: 'engineer', prd: 1, job: 'a', link: null, sentence: 'PRD 1\'s runner was lost: its resume carries the work on.' },
    ]);
  });

  it('records a held PRD sent again, then stopped the second time', () => {
    const once = events({ all: [facts(1)], runs: [run(1, 1, ended('a', 'held'))], recorded: [{ kind: 'dispatched', prd: 1, job: 'a' }] });
    expect(once).toEqual([{ kind: 'held', role: 'supervisor', prd: 1, job: 'a', link: null, sentence: 'PRD 1 was held: the mission sends it again, once.' }]);
    const twice = events({
      all: [facts(1)],
      runs: [run(1, 1, ended('a', 'held')), run(1, 2, ended('b', 'stopped'))],
      recorded: [{ kind: 'dispatched', prd: 1, job: 'a' }, { kind: 'held', prd: 1, job: 'a' }, { kind: 'dispatched', prd: 1, job: 'b' }],
    });
    expect(twice.map((e) => [e.kind, e.sentence])).toEqual([
      ['held', 'PRD 1 stopped mid-way a second time: it stops here.'],
      ['stopped', 'PRD 1 stops: it stopped mid-way twice.'],
      ['stopped', 'The mission stopped: PRD 1 stopped: it stopped mid-way twice. Take it to ready by hand and the mission carries on.'],
    ]);
  });

  it('records a merge, and Delivered once every PRD is merged', () => {
    const list = events({ all: [facts(1, { stage: 'merged' })], runs: [run(1, 1, ended('a', 'ready'))], recorded: [{ kind: 'dispatched', prd: 1, job: 'a' }, { kind: 'prd-ready', prd: 1, job: 'a' }] });
    expect(list.map((e) => [e.kind, e.role, e.sentence])).toEqual([
      ['prd-merged', 'supervisor', 'PRD 1 is merged: delivered.'],
      ['delivered', 'supervisor', 'Every PRD of the mission is merged: delivered.'],
    ]);
  });

  it('records a cancelled job, which pauses its PRD for good', () => {
    const list = events({ all: [facts(1), facts(2)], runs: [run(1, 1, attempt('a', { status: 'cancelled' })), run(2, 1, attempt('b'))], recorded: [{ kind: 'dispatched', prd: 1, job: 'a' }, { kind: 'dispatched', prd: 2, job: 'b' }] });
    expect(list).toEqual([{ kind: 'job-ended', role: 'engineer', prd: 1, job: 'a', link: null, sentence: 'PRD 1\'s job was cancelled: the mission never sends it again.' }]);
  });

  it('records a PRD found ready by its stage, with no job of the mission', () => {
    expect(events({ all: [facts(1, { stage: 'ready' })] }).map((e) => [e.kind, e.sentence])).toEqual([
      ['prd-ready', 'PRD 1 reads ready for review: it waits for a person to merge it.'],
      ['waits', 'Waits on a person: PRD 1: merge it'],
    ]);
  });

  it('never writes a sentence over 300 characters, nor a link that is not a web address', () => {
    const list = events({ all: [facts(1)], runs: [run(1, 1, attempt('a', { status: 'failed', reason: 'x'.repeat(400), prUrl: 'javascript:alert(1)' }))], recorded: [{ kind: 'dispatched', prd: 1, job: 'a' }] });
    for (const event of list) {
      expect(event.sentence.length).toBeLessThanOrEqual(300);
      expect(event.link).toBeNull();
    }
  });
});
