// PRD 1139, slice s1: one row per verdict of the spec's table, and an unreadable board.
import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd, parseWorkSliceId } from '../ids.ts';
import { WAKE_HINTS, approvalGate, decideNext, stalledSlices } from './decide.ts';
import type { ApprovalGate, BoardFacts, FeatureFacts, PrdFacts, StalledSlice } from './decide.ts';

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
const board = (over: Partial<BoardFacts> = {}): BoardFacts => ({ total: 2, merged: 0, wave: 1, takeable: [], inFlight: [], stalled: [], stallDays: 5, stuck: [], unreadable: [], ...over });
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

  const quiet = (id: string, pr: number, since: string): StalledSlice => ({ id: parseWorkSliceId(id), pr: parsePr(pr), url: `https://github.com/acme/widgets/pull/${pr}`, since });

  it('a slice in flight with no commit for stallDays parks on a person: its sub-PR, since when, take over or close, its link', () => {
    const verdict = decideNext(facts({ board: board({ merged: 1, inFlight: s('s1'), stalled: [quiet('s1', 20, '2026-10-02T09:00:00Z')] }) }));
    expect(verdict).toEqual({
      prd: PRD,
      verdict: 'park',
      why: "waits on a person: s1's sub-PR #20 has had no commit since 2026-10-02 (5 days or more); take it over or close it",
      link: 'https://github.com/acme/widgets/pull/20',
    });
  });

  it('several stalled slices are each named, the first linked', () => {
    const stalled = [quiet('s1', 20, '2026-10-02T09:00:00Z'), quiet('s2', 21, '2026-09-30T09:00:00Z')];
    const verdict = decideNext(facts({ board: board({ inFlight: s('s1', 's2'), stalled, stallDays: 3 }) }));
    expect(verdict).toEqual({
      prd: PRD,
      verdict: 'park',
      why: "waits on a person: s1's sub-PR #20 has had no commit since 2026-10-02, s2's sub-PR #21 since 2026-09-30 (3 days or more); take them over or close them",
      link: 'https://github.com/acme/widgets/pull/20',
    });
  });

  it('a live claim beside a stalled one still waits, naming only the live one', () => {
    const verdict = decideNext(facts({ board: board({ inFlight: s('s1', 's2'), stalled: [quiet('s1', 20, '2026-10-02T09:00:00Z')] }) }));
    expect(verdict).toMatchObject({ verdict: 'wait', why: 'another session holds the claim on s2', wakeHint: WAKE_HINTS.claim });
  });

  it('takeable slices still act before a stalled one parks', () => {
    const verdict = decideNext(facts({ board: board({ takeable: s('s2'), inFlight: s('s1'), stalled: [quiet('s1', 20, '2026-10-02T09:00:00Z')] }) }));
    expect(verdict).toMatchObject({ verdict: 'act', skill: 'wave' });
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

describe('stalledSlices', () => {
  const NOW = Date.parse('2026-10-07T09:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;
  const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
  const row = (id: string, state: string, pr: { number?: number; headCommitDate?: string | null } | null) => ({
    id: parseWorkSliceId(id),
    state,
    pr: pr === null ? null : { ...(pr.number === undefined ? {} : { number: parsePr(pr.number) }), headCommitDate: pr.headCommitDate ?? null },
  });
  const read = (rows: ReturnType<typeof row>[]) => stalledSlices(rows, { now: NOW, stallDays: 5, prUrl: (n) => `https://github.com/acme/widgets/pull/${n}` });

  it('an in-flight slice whose head commit is stallDays old or older is stalled, with its sub-PR, link and date', () => {
    expect(read([row('s1', 'in-flight', { number: 20, headCommitDate: at(5) })])).toEqual([
      { id: 's1', pr: 20, url: 'https://github.com/acme/widgets/pull/20', since: at(5) },
    ]);
  });

  it('a head commit a moment inside stallDays is not stalled', () => {
    expect(read([row('s1', 'in-flight', { number: 20, headCommitDate: new Date(NOW - 5 * DAY + 1000).toISOString() })])).toEqual([]);
  });

  it('an unknown head commit date, or no pull request number, is never read as stalled', () => {
    expect(read([row('s1', 'in-flight', { number: 20, headCommitDate: null }), row('s2', 'in-flight', { headCommitDate: at(9) })])).toEqual([]);
  });

  it('only in-flight slices stall: stuck, merged and claimed-stale ones have their own verdict', () => {
    const old = { number: 20, headCommitDate: at(9) };
    expect(read([row('s1', 'stuck', old), row('s2', 'merged', old), row('s3', 'claimed-stale', old), row('s4', 'runnable', null)])).toEqual([]);
  });
});

// PRD 1299, slice s5: a ◆ PRD's approval, read through `prdState()`, gates the verdict.
describe('decideNext — a ◆ PRD not approved (PRD 1299)', () => {
  const LINK = 'https://omni.test/prd/acme/widgets/7';
  const gate = (state: ApprovalGate['state'], lines: string[], link: string | null = LINK): ApprovalGate => ({ state, lines, link });

  it('waiting for approval parks it on a reviewer, naming its dossier link, as an open phase-0 PR does', () => {
    const verdict = decideNext(facts({ approval: gate('prd', [`PRD 7 waits for approval: ${LINK}`]) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on a reviewer: the PRD waits for approval on its page', link: LINK });
  });

  it('drifted parks it on a person with its lines', () => {
    const lines = ['≠ plan.md · content · ✗ refuse · restore it, or approve again: x'];
    const verdict = decideNext(facts({ approval: gate('drifted', lines) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: `waits on a person: ${lines[0]}`, link: LINK });
  });

  it('refused parks it on a person with its line, and without a link when it has none', () => {
    const verdict = decideNext(facts({ approval: gate('refused', ['approver ada is not a workspace member', 'and more'], null) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'park', why: 'waits on a person: approver ada is not a workspace member; and more' });
  });

  it('unreachable is held, not failed: a wait with the unreadable hint', () => {
    const verdict = decideNext(facts({ approval: gate('unreachable', ['server unreachable · held, not failed'], null) }));
    expect(verdict).toEqual({ prd: PRD, verdict: 'wait', why: 'server unreachable · held, not failed', wakeHint: WAKE_HINTS.unreadable });
  });

  it('comes after done: a merged feature PR is done whatever the approval says', () => {
    const verdict = decideNext(facts({ feature: feature({ state: 'MERGED' }), approval: gate('prd', ['x']) }));
    expect(verdict.verdict).toBe('done');
  });

  it('comes before GitHub unreachable', () => {
    const verdict = decideNext(facts({ feature: 'unreadable', approval: gate('prd', ['x']) }));
    expect(verdict.verdict).toBe('park');
  });

  it('in a plan repository, gates the same way', () => {
    const across = { repo: 'plan', targets: [] };
    expect(decideNext(facts({ across, approval: gate('prd', ['x']) }))).toMatchObject({ verdict: 'park', link: LINK });
    expect(decideNext(facts({ across, approval: gate('unreachable', ['y'], null) }))).toMatchObject({ verdict: 'wait', why: 'y' });
  });
});

describe('approvalGate', () => {
  const where = { prd: PRD, name: '0007-widgets', dir: 'd' };
  const reading = (state: 'approved' | 'pending' | 'drifted' | 'unreachable' | 'refused', url: string | null = 'L') =>
    ({ state, lines: [`${state} line`], url, approval: null, drift: [] });

  it('is null with no folder, for a ◇ PRD, for a shipped one and for an approved one', () => {
    expect(approvalGate(null)).toBeNull();
    expect(approvalGate({ ...where, birthplace: 'repo', state: 'inbox', approval: null })).toBeNull();
    expect(approvalGate({ ...where, birthplace: 'server', state: 'shipped', approval: null })).toBeNull();
    expect(approvalGate({ ...where, birthplace: 'server', state: 'inbox', approval: reading('approved') })).toBeNull();
  });

  it.each([
    ['prd', 'pending'],
    ['drifted', 'drifted'],
    ['unreachable', 'unreachable'],
    ['refused', 'refused'],
  ] as const)('stage %s carries its reading lines and link', (stage, state) => {
    expect(approvalGate({ ...where, birthplace: 'server', state: stage, approval: reading(state) })).toEqual({ state: stage, lines: [`${state} line`], link: 'L' });
  });
});
