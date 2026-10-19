// PRD 2175, s1: a claim whose job died. The board reads a draft sub-PR labelled `labels.released` as
// `claimed-stale` at once, and one still on `labels.inProgress` whose last commit and last update are
// both older than `limits.claimDeadMinutes` as `claimed-stale` too. An unknown date is never stale
// (BR-PRODUCT-2). Its own file: `board.test.ts` proves rules and stays as it is.
import { describe, expect, it } from 'vitest';
import { boardFor, couldBeDead, deadClaimRules, isClaimedStale } from './board.ts';
import type { BoardPr, BoardSlice, DeadClaimRules } from './board.ts';
import { DEFAULT_CLAIM_DEAD_MINUTES, DEFAULT_RELEASED_LABEL } from './config.ts';
import { parsePr, parseWorkSliceId } from './ids.ts';

const NOW = new Date('2026-10-19T12:00:00Z').getTime();
const MINUTE_MS = 60_000;
const ago = (minutes: number) => new Date(NOW - minutes * MINUTE_MS).toISOString();

const IN_PROGRESS = 'omni:in-progress';
const RELEASED = 'omni:released';

const CONFIG = {
  branches: { feature: 'feat/{topic}', slice: 'feat/{topic}--{slice}' },
  board: { matchBy: 'base' },
  labels: { sub: 'omni:sub', needsFix: 'omni:needs-fix', inProgress: IN_PROGRESS, released: RELEASED },
};

const LIMITS = { claimStaleMinutes: 60, claimDeadMinutes: 240 };

const RULES: DeadClaimRules = { deadMinutes: 240, inProgressLabel: IN_PROGRESS, releasedLabel: RELEASED };

const SLICE: BoardSlice = { id: parseWorkSliceId('s1'), title: 'A slice', territory: ['a/'], wave: 1, blockedBy: [] };

/** A draft sub-PR on `omni:in-progress` that moved beyond its claim: in flight under today's rule alone. */
function draft(overrides: Partial<BoardPr> = {}): BoardPr {
  return {
    number: parsePr(1),
    title: 's1',
    headRefName: 'feat/widgets--s1',
    baseRefName: 'feat/widgets',
    state: 'OPEN',
    isDraft: true,
    mergedAt: null,
    body: '',
    labels: [IN_PROGRESS],
    createdAt: ago(1000),
    headCommitDate: ago(30),
    updatedAt: ago(30),
    ...overrides,
  };
}

/** A draft quiet for `minutes`: its last commit and its last update both that old. */
const quiet = (minutes: number, overrides: Partial<BoardPr> = {}) => draft({ headCommitDate: ago(minutes), updatedAt: ago(minutes), ...overrides });

function stateOf(pr: BoardPr, { config = CONFIG, limits = LIMITS }: { config?: typeof CONFIG; limits?: typeof LIMITS } = {}): string {
  const [row] = boardFor({ slices: [SLICE], prs: [pr], now: NOW, limits, config, prd: { topic: 'widgets' } }).slices;
  return row?.state ?? 'no row';
}

describe('the board reads a released claim as stale at once (PRD 2175)', () => {
  it('reads a draft labelled released as claimed-stale, however fresh its commits', () => {
    expect(stateOf(draft({ labels: [RELEASED], headCommitDate: ago(1), updatedAt: ago(1), createdAt: ago(2) }))).toBe('claimed-stale');
  });

  it('reads it so whatever its labels are given as: names or objects', () => {
    expect(stateOf(draft({ labels: [{ name: 'omni:sub' }, { name: RELEASED }], updatedAt: ago(1) }))).toBe('claimed-stale');
  });

  it('reads a released draft as stale even when its dates cannot be read: the label is the signal', () => {
    expect(stateOf(draft({ labels: [RELEASED], headCommitDate: null, updatedAt: undefined }))).toBe('claimed-stale');
  });

  it('never reads a released pull request that is not a draft as stale', () => {
    expect(stateOf(draft({ labels: [RELEASED], isDraft: false }))).toBe('in-flight');
  });

  it('reads the label the config names, not the default', () => {
    const config = { ...CONFIG, labels: { ...CONFIG.labels, released: 'dead-claim' } };
    expect(stateOf(draft({ labels: ['dead-claim'] }), { config })).toBe('claimed-stale');
    expect(stateOf(draft({ labels: [RELEASED] }), { config })).toBe('in-flight');
  });
});

describe('the board reads a quiet claim as stale past limits.claimDeadMinutes (PRD 2175)', () => {
  it('reads a draft quiet for 241 minutes as claimed-stale', () => {
    expect(stateOf(quiet(241))).toBe('claimed-stale');
  });

  it('reads one quiet for 239 minutes, or exactly 240, as in-flight', () => {
    expect(stateOf(quiet(239))).toBe('in-flight');
    expect(stateOf(quiet(240))).toBe('in-flight');
  });

  it('needs both the last commit and the last update older than the limit', () => {
    expect(stateOf(quiet(300, { updatedAt: ago(100) }))).toBe('in-flight');
    expect(stateOf(quiet(300, { headCommitDate: ago(100) }))).toBe('in-flight');
  });

  it('needs the claim still on labels.inProgress', () => {
    expect(stateOf(quiet(300, { labels: [] }))).toBe('in-flight');
    expect(stateOf(quiet(300, { labels: ['omni:sub'] }))).toBe('in-flight');
  });

  it('never reads a quiet pull request that is not a draft as stale', () => {
    expect(stateOf(quiet(300, { isDraft: false }))).toBe('in-flight');
  });

  it('reads limits.claimDeadMinutes as the config sets it', () => {
    expect(stateOf(quiet(100), { limits: { claimStaleMinutes: 60, claimDeadMinutes: 90 } })).toBe('claimed-stale');
    expect(stateOf(quiet(300), { limits: { claimStaleMinutes: 60, claimDeadMinutes: 400 } })).toBe('in-flight');
  });

  it('takes the kit default, 240 minutes, when the limits leave it out', () => {
    expect(DEFAULT_CLAIM_DEAD_MINUTES).toBe(240);
    const limits = { claimStaleMinutes: 60 } as typeof LIMITS;
    expect(stateOf(quiet(241), { limits })).toBe('claimed-stale');
    expect(stateOf(quiet(239), { limits })).toBe('in-flight');
  });
});

describe('an unknown date is never stale (BR-PRODUCT-2)', () => {
  it('reads a quiet draft whose head commit date cannot be read as in-flight', () => {
    expect(stateOf(quiet(600, { headCommitDate: null }))).toBe('in-flight');
    expect(stateOf(quiet(600, { headCommitDate: undefined }))).toBe('in-flight');
  });

  it('reads a quiet draft whose last update cannot be read as in-flight', () => {
    expect(stateOf(quiet(600, { updatedAt: undefined }))).toBe('in-flight');
    expect(stateOf(quiet(600, { updatedAt: 'not a date' }))).toBe('in-flight');
  });
});

describe('the earlier states still win (PRD 2175)', () => {
  it('reads a merged pull request as merged, released or quiet', () => {
    expect(stateOf(draft({ labels: [RELEASED], state: 'MERGED', mergedAt: ago(5) }))).toBe('merged');
    expect(stateOf(quiet(600, { state: 'MERGED', mergedAt: ago(5) }))).toBe('merged');
  });

  it('reads a pull request on labels.needsFix as stuck, released or quiet', () => {
    expect(stateOf(draft({ labels: [RELEASED, 'omni:needs-fix'] }))).toBe('stuck');
    expect(stateOf(quiet(600, { labels: [IN_PROGRESS, 'omni:needs-fix'] }))).toBe('stuck');
  });

  it('makes a released or quiet slice takeable on the frontier', () => {
    const result = boardFor({ slices: [SLICE], prs: [draft({ labels: [RELEASED] })], now: NOW, limits: LIMITS, config: CONFIG, prd: { topic: 'widgets' } });
    expect(result.frontier.takeable).toEqual(['s1']);
    expect(result.frontier.runnable).toEqual([]);
  });
});

describe("today's cold-claim rule is unchanged (PRD 2175)", () => {
  it('reads a draft with nothing beyond its claim as stale after claimStaleMinutes, whatever its labels', () => {
    expect(stateOf(draft({ labels: [], createdAt: ago(61), headCommitDate: ago(61), updatedAt: ago(1) }))).toBe('claimed-stale');
    expect(stateOf(draft({ labels: [], createdAt: ago(59), headCommitDate: ago(59), updatedAt: ago(1) }))).toBe('in-flight');
  });

  it('reads a fresh draft on labels.inProgress with commits beyond its claim as in-flight', () => {
    expect(stateOf(draft())).toBe('in-flight');
  });

  it('leaves the three-argument isClaimedStale as it was: no label and no quiet time read', () => {
    expect(isClaimedStale(draft({ labels: [RELEASED] }), NOW, 60)).toBe(false);
    expect(isClaimedStale(quiet(600), NOW, 60)).toBe(false);
    expect(isClaimedStale(draft({ createdAt: ago(61), headCommitDate: ago(61) }), NOW, 60)).toBe(true);
  });

  it('reads no quiet or released claim on a board whose config names no in-progress label', () => {
    const labels = { sub: 'omni:sub', needsFix: 'omni:needs-fix' };
    const result = boardFor({ slices: [SLICE], prs: [quiet(600, { labels: [IN_PROGRESS, RELEASED] })], now: NOW, limits: LIMITS, config: { ...CONFIG, labels }, prd: { topic: 'widgets' } });
    expect(result.slices[0]?.state).toBe('in-flight');
  });
});

describe('isClaimedStale with the dead-claim rules (PRD 2175)', () => {
  it('reads released, quiet and cold claims as stale, and nothing else', () => {
    expect(isClaimedStale(draft({ labels: [RELEASED] }), NOW, 60, RULES)).toBe(true);
    expect(isClaimedStale(quiet(241), NOW, 60, RULES)).toBe(true);
    expect(isClaimedStale(quiet(239), NOW, 60, RULES)).toBe(false);
    expect(isClaimedStale(draft({ labels: [], createdAt: ago(61), headCommitDate: ago(61) }), NOW, 60, RULES)).toBe(true);
    expect(isClaimedStale(draft(), NOW, 60, RULES)).toBe(false);
    expect(isClaimedStale(draft(), NOW, 60, null)).toBe(false);
  });

  it('reads a label with no name as no label at all', () => {
    expect(isClaimedStale(quiet(600, { labels: [null, undefined, { name: null }, {}] }), NOW, 60, RULES)).toBe(false);
  });
});

describe('deadClaimRules — the rules a board reads from its config (PRD 2175)', () => {
  it('names both labels and the quiet time', () => {
    expect(deadClaimRules(CONFIG.labels, LIMITS)).toEqual(RULES);
  });

  it('takes the default quiet time when the limits leave it out', () => {
    expect(deadClaimRules(CONFIG.labels, { claimStaleMinutes: 60 })).toEqual({ ...RULES, deadMinutes: DEFAULT_CLAIM_DEAD_MINUTES });
  });

  it('takes the default released label when the labels leave it out', () => {
    expect(deadClaimRules({ sub: 'omni:sub', needsFix: 'omni:needs-fix', inProgress: IN_PROGRESS }, LIMITS)).toEqual({ ...RULES, releasedLabel: DEFAULT_RELEASED_LABEL });
    expect(DEFAULT_RELEASED_LABEL).toBe(RELEASED);
  });

  it('is null when the labels name no in-progress label', () => {
    expect(deadClaimRules({ sub: 'omni:sub', needsFix: 'omni:needs-fix' }, LIMITS)).toBeNull();
    expect(deadClaimRules({ sub: 'omni:sub', needsFix: 'omni:needs-fix', released: RELEASED }, LIMITS)).toBeNull();
  });
});

describe('couldBeDead — the drafts worth a read of their head commit date (PRD 2175)', () => {
  it('is true for a released draft, whatever its last update', () => {
    expect(couldBeDead({ labels: [RELEASED], updatedAt: ago(1) }, NOW, RULES)).toBe(true);
    expect(couldBeDead({ labels: [RELEASED] }, NOW, RULES)).toBe(true);
  });

  it('is true for one on labels.inProgress last updated more than the quiet time ago, and only then', () => {
    expect(couldBeDead({ labels: [IN_PROGRESS], updatedAt: ago(241) }, NOW, RULES)).toBe(true);
    expect(couldBeDead({ labels: [IN_PROGRESS], updatedAt: ago(240) }, NOW, RULES)).toBe(false);
    expect(couldBeDead({ labels: [IN_PROGRESS], updatedAt: ago(239) }, NOW, RULES)).toBe(false);
    expect(couldBeDead({ labels: [IN_PROGRESS] }, NOW, RULES)).toBe(false);
    expect(couldBeDead({ labels: [IN_PROGRESS], updatedAt: '' }, NOW, RULES)).toBe(false);
  });

  it('is false for one on neither label, however old', () => {
    expect(couldBeDead({ labels: ['omni:sub'], updatedAt: ago(600) }, NOW, RULES)).toBe(false);
    expect(couldBeDead({ labels: null, updatedAt: ago(600) }, NOW, RULES)).toBe(false);
  });
});
