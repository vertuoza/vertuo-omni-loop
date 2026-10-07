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

// PRD 1162, slice s1: in a plan repository, one row per verdict of the spec's part 3 table — read from
// the plan PR (the plan repository's feature PR), each target's feature PR and the board across them.
describe('decideNext in a plan repository', () => {
  const PLAN_URL = 'https://github.com/acme/plans/pull/12';
  const CREW_URL = 'https://github.com/acme/crew/pull/40';
  const AI_URL = 'https://github.com/acme/ai-domain/pull/41';
  const across = (over: Partial<PrdFacts> = {}, targets: { crew?: FeatureFacts | null | 'unreadable'; ai?: FeatureFacts | null | 'unreadable' } = {}): PrdFacts => ({
    ...facts({ feature: feature({ url: PLAN_URL }), ...over }),
    across: {
      repo: 'plans',
      targets: [
        { repo: 'crew', pr: 'crew' in targets ? (targets.crew ?? null) : feature({ url: CREW_URL }) },
        { repo: 'ai-domain', pr: 'ai' in targets ? (targets.ai ?? null) : feature({ url: AI_URL }) },
      ],
    },
  });
  const ready = (url: string, over: Partial<FeatureFacts> = {}) => feature({ url, isDraft: false, ...over });
  const NEVER = new Set(['wave', 'yolo', 'yolo-fix', 'pr-care --once']);

  it.each([
    ['red CI', { checks: 'red', fixable: true } as const, 'red CI'],
    ['a conflict', { conflict: true }, 'a conflict'],
    ['a new review thread', { threads: 1 }, '1 review thread to handle'],
  ])('a ready target PR with %s → act mega-pr-care --once, naming the PR by repository', (_, over, need) => {
    const verdict = decideNext(across({ feature: ready(PLAN_URL), board: allMerged }, { crew: ready(CREW_URL, over), ai: ready(AI_URL) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'act', skill: 'mega-pr-care --once', why: `crew#40 has ${need}`, link: CREW_URL });
  });

  it('a ready plan PR with red CI → act mega-pr-care --once too', () => {
    const verdict = decideNext(across({ feature: ready(PLAN_URL, { checks: 'red', fixable: true }), board: allMerged }));
    expect(verdict).toMatchObject({ verdict: 'act', skill: 'mega-pr-care --once', why: 'plans#12 has red CI', link: PLAN_URL });
  });

  it('a ready PR whose red CI is stuck parks on a person, naming it', () => {
    const verdict = decideNext(across({ board: allMerged }, { ai: ready(AI_URL, { checks: 'red', fixable: true, stuck: true }) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: "waits on a person: ai-domain#41's CI is stuck after its attempts", link: AI_URL });
  });

  it('gate red with answers on the plan PR → act ultra-yolo-fix', () => {
    const verdict = decideNext(across({ board: allMerged, outbox: { questions: 2, answered: true } }));
    expect(verdict).toMatchObject({ verdict: 'act', skill: 'ultra-yolo-fix', link: PLAN_URL });
  });

  it('no plan yet → act ultra-yolo', () => {
    expect(decideNext(across({ feature: null, board: null }, { crew: null, ai: null }))).toEqual({ prd: PRD, verdict: 'act', skill: 'ultra-yolo', why: 'the PRD has no plan yet' });
  });

  it('every slice merged with a target PR still draft → act ultra-yolo, naming it', () => {
    const verdict = decideNext(across({ feature: ready(PLAN_URL), board: allMerged }, { crew: ready(CREW_URL) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'act', skill: 'ultra-yolo', why: 'every slice is merged and ai-domain#41 is not ready yet', link: AI_URL });
  });

  it('every slice merged with a target PR not opened yet, or the plan PR draft → act ultra-yolo', () => {
    const missing = decideNext(across({ feature: ready(PLAN_URL), board: allMerged }, { crew: ready(CREW_URL), ai: null }));
    expect(missing).toMatchObject({ verdict: 'act', skill: 'ultra-yolo', why: "every slice is merged and ai-domain's feature PR is not opened yet" });
    const draft = decideNext(across({ board: allMerged }, { crew: ready(CREW_URL), ai: ready(AI_URL) }));
    expect(draft).toMatchObject({ verdict: 'act', skill: 'ultra-yolo', why: 'every slice is merged and plans#12 is not ready yet', link: PLAN_URL });
  });

  it('takeable slices in any repository → act ultra-wave', () => {
    expect(decideNext(across())).toMatchObject({ verdict: 'act', skill: 'ultra-wave', why: 'wave 1 can take s1, s2', link: PLAN_URL });
  });

  it('CI running in any repository → wait, with the CI hint', () => {
    const verdict = decideNext(across({ feature: ready(PLAN_URL), board: allMerged }, { crew: ready(CREW_URL, { checks: 'running' }), ai: ready(AI_URL) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'wait', why: "crew#40's CI is running", wakeHint: WAKE_HINTS.ci, link: CREW_URL });
  });

  it('a claim held → wait, with the claim hint', () => {
    expect(decideNext(across({ board: board({ merged: 1, inFlight: s('s2') }) }))).toMatchObject({ verdict: 'wait', wakeHint: WAKE_HINTS.claim });
  });

  it('phase-0 open → park, naming the PR by repository', () => {
    const verdict = decideNext(across({ phase0: { url: 'https://github.com/acme/plans/pull/3' }, feature: null, board: null }, { crew: null, ai: null }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on a reviewer: the phase-0 PR plans#3 is open', link: 'https://github.com/acme/plans/pull/3' });
  });

  it('outbox questions open → park on the plan PR author, naming the plan PR', () => {
    const verdict = decideNext(across({ board: allMerged, outbox: { questions: 1, answered: false } }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on @pm: 1 outbox question to answer on plans#12', link: PLAN_URL });
  });

  it('every PR ready and clean → park, naming each open PR by repository', () => {
    const verdict = decideNext(across({ feature: ready(PLAN_URL), board: allMerged }, { crew: ready(CREW_URL), ai: ready(AI_URL) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on a person: ready to merge: plans#12, crew#40, ai-domain#41', link: PLAN_URL });
  });

  it('a target merged already is not named in the park', () => {
    const verdict = decideNext(across({ feature: ready(PLAN_URL), board: allMerged }, { crew: ready(CREW_URL, { state: 'MERGED' }), ai: ready(AI_URL) }));
    expect(verdict).toMatchObject({ verdict: 'park', why: 'waits on a person: ready to merge: plans#12, ai-domain#41' });
  });

  it('every PR merged or closed → done; the plan PR merged with a target PR open is not', () => {
    const merged = (url: string) => feature({ url, state: 'MERGED', isDraft: false });
    expect(decideNext(across({ feature: merged(PLAN_URL), board: allMerged }, { crew: merged(CREW_URL), ai: feature({ url: AI_URL, state: 'CLOSED' }) }))).toEqual({
      prd: PRD,
      verdict: 'done',
      why: 'the plan PR and every target PR are merged or closed',
      link: PLAN_URL,
    });
    expect(decideNext(across({ feature: merged(PLAN_URL), board: allMerged }, { crew: merged(CREW_URL), ai: ready(AI_URL) }))).toMatchObject({ verdict: 'park' });
  });

  it('a target that cannot be read → wait: github unreachable', () => {
    expect(decideNext(across({}, { crew: 'unreadable' }))).toMatchObject({ verdict: 'wait', why: 'github unreachable', wakeHint: WAKE_HINTS.unreadable });
  });

  it('never names a single-repository skill', () => {
    const cases: PrdFacts[] = [
      across(),
      across({ feature: null, board: null }, { crew: null, ai: null }),
      across({ board: allMerged }),
      across({ board: allMerged, outbox: { questions: 1, answered: true } }),
      across({ feature: ready(PLAN_URL, { threads: 2 }), board: allMerged }),
    ];
    for (const verdict of cases.map(decideNext)) if (verdict.verdict === 'act') expect(NEVER.has(verdict.skill)).toBe(false);
  });
});
