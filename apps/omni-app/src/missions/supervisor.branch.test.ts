import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { conclude, eventsOf, featurePrOf, onBranchOf, pick, prdStates, recordedKeys, type Attempt, type Mission, type OnBranch, type PrdFacts, type Run } from './supervisor.ts';

// A PRD joins its mission's branch (PRD 2896 s4, criteria 6 and 7): the states, the pick, the words and the events of it.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-22T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
const p = (n: number): PrdNumber => parsePrd(n);

const mission = (over: Partial<Mission> = {}): Mission => ({ id: ID, fleet: 'night-shift', status: 'running', parallel: 1, waitingOn: null, level: 'own-branch', number: 12, title: 'Faster quotes', ...over });
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });
const ready = (n: number, prUrl: string | null = `https://github.com/acme/widgets/pull/${String(40 + n)}`): Run => ({
  prd: p(n),
  run: 1,
  step: 'build',
  job: `job-${String(n)}`,
  attempts: [{ id: `job-${String(n)}`, status: 'done', outcome: 'ready', reason: null, prUrl } satisfies Attempt],
});
const branch = (over: Partial<OnBranch> = {}): OnBranch => ({ branch: BRANCH, joined: new Set(), lacks: new Map(), ...over });

describe('where a PRD is on a mission branch', () => {
  it('a Ready PRD the gate judged waits on what it lacks, not on a person to merge it', () => {
    const lacks = new Map([[p(1), ['test failed', 'the Reviewer has not reviewed it']]]);
    expect(prdStates([facts(1)], [ready(1)], branch({ lacks })).get(p(1))).toEqual({ state: 'waits', on: 'join', lacks: ['test failed', 'the Reviewer has not reviewed it'] });
    expect(prdStates([facts(1, { stage: 'ready' })], [], branch({ lacks })).get(p(1))).toEqual({ state: 'waits', on: 'join', lacks: ['test failed', 'the Reviewer has not reviewed it'] });
  });

  it('a Ready PRD the gate did not judge waits for its merge, as at with-you', () => {
    expect(prdStates([facts(1)], [ready(1)], branch()).get(p(1))).toEqual({ state: 'waits', on: 'merge' });
    expect(prdStates([facts(1)], [ready(1)]).get(p(1))).toEqual({ state: 'waits', on: 'merge' });
  });

  it('a PRD on the branch is joined, until its commit reaches the default branch', () => {
    expect(prdStates([facts(1)], [ready(1)], branch({ joined: new Set([p(1)]) })).get(p(1))).toEqual({ state: 'joined' });
    expect(prdStates([facts(1, { stage: 'merged' })], [ready(1)], branch({ joined: new Set([p(1)]) })).get(p(1))).toEqual({ state: 'merged' });
  });

  it('a PRD on the branch unblocks the PRDs it blocked, and counts toward no mandate.parallel (criterion 7)', () => {
    const all = [facts(1), facts(2, { blockers: [p(1)] })];
    expect(prdStates(all, [ready(1)]).get(p(2))).toEqual({ state: 'blocked', by: [p(1)] });
    const on = branch({ joined: new Set([p(1)]) });
    const states = prdStates(all, [ready(1)], on);
    expect(states.get(p(2))).toEqual({ state: 'startable', run: 1, step: 'build' });
    expect(pick({ mission: mission({ parallel: 1 }), facts: all, states })).toEqual([{ prd: p(2), run: 1, step: 'build' }]);
  });
});

describe('onBranchOf: the PRDs on the branch, from the mission\'s events in order', () => {
  it('reads a join, then a drop or a landing takes the PRD off', () => {
    const event = (kind: string, n: number | null) => ({ kind, prd: n === null ? null : p(n), job: null });
    expect([...onBranchOf([event('prd-joined', 1), event('prd-joined', 2), event('prd-dropped', 2), event('dispatched', 3), event('waits', null)])]).toEqual([p(1)]);
    expect([...onBranchOf([event('prd-joined', 1), event('landed', 1)])]).toEqual([]);
    expect([...onBranchOf([event('prd-joined', 1), event('prd-dropped', 1), event('prd-joined', 1)])]).toEqual([p(1)]);
  });
});

describe('featurePrOf: the feature pull request a PRD\'s jobs link', () => {
  it('is the one its latest job links, a Reviewer\'s review link included', () => {
    const review: Run = { prd: p(1), run: 1, step: 'review:1', job: 'r-1', attempts: [{ id: 'r-1', status: 'done', outcome: 'ready', reason: null, prUrl: null, posted: { findings: 0, url: 'https://github.com/acme/widgets/pull/52#pullrequestreview-9' } }] };
    expect(featurePrOf([ready(1, 'https://github.com/acme/widgets/pull/41'), review], p(1))).toBe(parsePr(52));
    expect(featurePrOf([ready(1, 'https://github.com/acme/widgets/pull/41')], p(1))).toBe(parsePr(41));
  });

  it('is none when no job of the PRD links one', () => {
    expect(featurePrOf([ready(1, null)], p(1))).toBeNull();
    expect(featurePrOf([ready(2)], p(1))).toBeNull();
  });
});

describe('what the mission waits on, on its branch', () => {
  it('says what the gate lacks for each PRD, then the PRDs on the branch waiting to land', () => {
    const all = [facts(1), facts(2), facts(3)];
    const on = branch({ joined: new Set([p(2), p(3)]), lacks: new Map([[p(1), ['test failed', '1 high item open']]]) });
    expect(conclude({ mission: mission(), facts: all, states: prdStates(all, [ready(1)], on), sent: 0, now: NOW, branch: BRANCH })).toEqual({
      status: 'waiting',
      waitingOn: `PRD 1: joins ${BRANCH} once: test failed; 1 high item open · on ${BRANCH}, to land: PRD 2, PRD 3`,
      nextWakeAt: new Date(NOW + 60_000).toISOString(),
    });
  });

  it('is not delivered while its PRDs are only on the branch', () => {
    const all = [facts(1)];
    expect(conclude({ mission: mission(), facts: all, states: prdStates(all, [], branch({ joined: new Set([p(1)]) })), sent: 0, now: NOW, branch: BRANCH }).status).toBe('waiting');
  });
});

describe('the events of a join', () => {
  const events = (input: { joins?: { prd: PrdNumber; pr: ReturnType<typeof parsePr>; url: string }[]; on?: OnBranch; m?: Mission; recorded?: { kind: string; prd: PrdNumber | null; job: string | null }[] }) => {
    const m = input.m ?? mission();
    const all = [facts(1)];
    const on = input.on ?? branch();
    const states = prdStates(all, [ready(1)], on);
    const next = conclude({ mission: m, facts: all, states, sent: 0, now: NOW, branch: on.branch });
    return eventsOf({ mission: m, facts: all, states, runs: [ready(1)], next, toFleet: true, recorded: recordedKeys(input.recorded ?? []), joins: input.joins ?? [] });
  };

  it('records one prd-joined per PRD this run joined, signed by the supervisor, linking its pull request', () => {
    const joined = events({ joins: [{ prd: p(1), pr: parsePr(41), url: 'https://github.com/acme/widgets/pull/41' }], on: branch({ joined: new Set([p(1)]) }) }).filter((event) => event.kind === 'prd-joined');
    expect(joined).toEqual([{ kind: 'prd-joined', role: 'supervisor', prd: p(1), job: null, link: 'https://github.com/acme/widgets/pull/41', sentence: `PRD 1 joined ${BRANCH}: #41 squash-merged.` }]);
  });

  it('records no join when none was made in this run', () => {
    expect(events({ on: branch({ joined: new Set([p(1)]) }) }).some((event) => event.kind === 'prd-joined')).toBe(false);
  });

  it('says a Ready PRD joins the branch once the gate passes, never that a person merges it', () => {
    const [, end] = events({});
    expect(end).toMatchObject({ kind: 'prd-ready', sentence: `PRD 1 is ready for review: it joins ${BRANCH} once the merge gate passes.` });
    const [, plain] = events({ m: mission({ level: 'with-you' }), on: { branch: null, joined: new Set(), lacks: new Map() } });
    expect(plain).toMatchObject({ kind: 'prd-ready', sentence: 'PRD 1 is ready for review: it waits for a person to merge it.' });
  });
});
