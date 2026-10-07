// PRD 1139, slice s1: one row per verdict of the spec's table, and an unreadable board.
import { describe, expect, it } from 'vitest';
import { parsePrd, parseWorkSliceId } from '../ids.ts';
import { WAKE_HINTS, decideNext } from './decide.ts';
import type { BoardFacts, FeatureFacts, PrdFacts } from './decide.ts';

const PRD = parsePrd(7);
const URL = 'https://github.com/acme/widgets/pull/9';
const s = (...list: string[]) => list.map(parseWorkSliceId);

const feature = (over: Partial<FeatureFacts> = {}): FeatureFacts => ({
  url: URL,
  state: 'OPEN',
  isDraft: true,
  author: 'pm',
  checks: 'green',
  fixable: false,
  stuck: false,
  conflict: false,
  threads: 0,
  ...over,
});
const board = (over: Partial<BoardFacts> = {}): BoardFacts => ({ total: 2, merged: 0, wave: 1, takeable: [], inFlight: [], stuck: [], unreadable: [], ...over });
const allMerged = board({ merged: 2, wave: null });
const facts = (over: Partial<PrdFacts> = {}): PrdFacts => ({
  prd: PRD,
  shipped: false,
  phase0: null,
  feature: feature(),
  board: board({ takeable: s('s1', 's2') }),
  outbox: { questions: 0, answered: false },
  ...over,
});

describe('decideNext', () => {
  it.each([
    ['red CI', { checks: 'red', fixable: true } as const],
    ['a conflict', { conflict: true }],
    ['a new review thread', { threads: 1 }],
  ])('a ready feature PR with %s → act pr-care --once', (_, over) => {
    const verdict = decideNext(facts({ feature: feature({ isDraft: false, ...over }), board: allMerged }));
    expect(verdict).toMatchObject({ prd: PRD, verdict: 'act', skill: 'pr-care --once', link: URL });
  });

  it('a draft feature PR with red CI is not cared for: the waves go on', () => {
    expect(decideNext(facts({ feature: feature({ checks: 'red', fixable: true }) }))).toMatchObject({ verdict: 'act', skill: 'wave' });
  });

  it('red only on the outbox gate is the gate doing its job, not CI to fix', () => {
    const verdict = decideNext(facts({ feature: feature({ isDraft: false, checks: 'red', fixable: false }), board: allMerged }));
    expect(verdict).toMatchObject({ verdict: 'park' });
  });

  it('a ready feature PR whose red CI is stuck parks on a person', () => {
    const verdict = decideNext(facts({ feature: feature({ isDraft: false, checks: 'red', fixable: true, stuck: true }), board: allMerged }));
    expect(verdict).toMatchObject({ verdict: 'park', link: URL });
    expect(verdict.why).toMatch(/stuck/);
  });

  it('gate red with answers posted → act yolo-fix', () => {
    const verdict = decideNext(facts({ board: allMerged, outbox: { questions: 2, answered: true } }));
    expect(verdict).toMatchObject({ verdict: 'act', skill: 'yolo-fix', link: URL });
  });

  it('every slice merged and the PR draft → act yolo', () => {
    expect(decideNext(facts({ board: allMerged }))).toMatchObject({ verdict: 'act', skill: 'yolo' });
  });

  it('every slice merged and no feature PR yet → act yolo', () => {
    expect(decideNext(facts({ feature: null, board: allMerged }))).toEqual({ prd: PRD, verdict: 'act', skill: 'yolo', why: 'every slice is merged and the feature PR is not ready yet' });
  });

  it('a PRD with no plan yet → act yolo', () => {
    expect(decideNext(facts({ feature: null, board: null }))).toMatchObject({ verdict: 'act', skill: 'yolo', why: 'the PRD has no plan yet' });
  });

  it('takeable slices → act wave, naming the wave and the slices', () => {
    expect(decideNext(facts())).toMatchObject({ verdict: 'act', skill: 'wave', why: 'wave 1 can take s1, s2', link: URL });
  });

  it('CI running on a ready PR → wait, with the CI hint', () => {
    const verdict = decideNext(facts({ feature: feature({ isDraft: false, checks: 'running' }), board: allMerged }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'wait', why: "the feature PR's CI is running", wakeHint: WAKE_HINTS.ci, link: URL });
  });

  it('a claim held by another session → wait, with the claim hint', () => {
    const verdict = decideNext(facts({ board: board({ merged: 1, inFlight: s('s2') }) }));
    expect(verdict).toMatchObject({ verdict: 'wait', wakeHint: WAKE_HINTS.claim });
    expect(verdict.why).toMatch(/s2/);
  });

  it('a stuck slice with nothing else to take parks on a person', () => {
    expect(decideNext(facts({ board: board({ merged: 1, stuck: s('s2') }) }))).toMatchObject({ verdict: 'park', why: 'waits on a person: s2 stuck' });
  });

  it('only blocked or unreadable slices left → wait', () => {
    expect(decideNext(facts({ board: board({ unreadable: s('s2') }) }))).toMatchObject({ verdict: 'wait', wakeHint: WAKE_HINTS.unreadable });
    expect(decideNext(facts({ board: board() }))).toMatchObject({ verdict: 'wait', wakeHint: WAKE_HINTS.claim });
  });

  it('phase-0 open → park, on a reviewer, with its link', () => {
    const verdict = decideNext(facts({ phase0: { url: 'https://github.com/acme/widgets/pull/3' }, feature: null, board: null }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on a reviewer: the phase-0 PR is open', link: 'https://github.com/acme/widgets/pull/3' });
  });

  it('outbox questions open once every slice is merged → park, on the PR author, with its link', () => {
    const verdict = decideNext(facts({ board: allMerged, outbox: { questions: 2, answered: false } }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on @pm: 2 outbox questions to answer', link: URL });
  });

  it('outbox questions open mid-build do not stop the waves', () => {
    expect(decideNext(facts({ outbox: { questions: 1, answered: true } }))).toMatchObject({ verdict: 'act', skill: 'wave' });
  });

  it('a ready PR, clean and green → park, waiting to be merged', () => {
    const verdict = decideNext(facts({ feature: feature({ isDraft: false }), board: allMerged }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on a person: the feature PR is ready to merge', link: URL });
  });

  it.each(['MERGED', 'CLOSED'])('a feature PR %s → done', (state) => {
    expect(decideNext(facts({ feature: feature({ state }) }))).toEqual({ prd: PRD, verdict: 'done', why: `the feature PR is ${state.toLowerCase()}`, link: URL });
  });

  it('a shipped PRD with no feature PR found → done', () => {
    expect(decideNext(facts({ shipped: true, feature: null }))).toMatchObject({ verdict: 'done' });
  });

  it('an unreadable board → wait', () => {
    expect(decideNext(facts({ board: 'unreadable' }))).toMatchObject({ verdict: 'wait', why: 'the board cannot be read', wakeHint: WAKE_HINTS.unreadable });
  });

  it('GitHub unreachable → wait: github unreachable', () => {
    expect(decideNext(facts({ feature: 'unreadable' }))).toEqual({ prd: PRD, verdict: 'wait', why: 'github unreachable', wakeHint: WAKE_HINTS.unreadable });
    expect(decideNext(facts({ outbox: 'unreadable' }))).toMatchObject({ verdict: 'wait', why: 'github unreachable' });
  });
});
