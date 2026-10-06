import { describe, expect, it } from 'vitest';
import { boardFor, fillBranch, isClaimedStale, landingBranches, runnableFrontier } from './board.ts';
import type { BoardLanding, BoardPr, BoardRepos, BoardSlice, FrontierRow } from './board.ts';
import { assertDefined } from '../test/assert.ts';
import { parsePr, parseWorkSliceId } from './ids.ts';

/** The board's first row, proved present. */
function firstRow<R>(result: { slices: readonly R[] }): NonNullable<R> {
  const [row] = result.slices;
  assertDefined(row, 'the first row');
  return row;
}

/** The board's row `id`, proved present. */
function rowOf<R extends { id: string }>(result: { slices: readonly R[] }, id: string): R {
  const row = result.slices.find((candidate) => candidate.id === id);
  assertDefined(row, `row ${id}`);
  return row;
}

/** A row's matched pull request, proved present. */
function prOf<P>(row: { pr: P | null }): NonNullable<P> {
  const { pr } = row;
  assertDefined(pr, 'the matched pull request');
  return pr;
}

const NOW = new Date('2026-09-25T12:00:00Z').getTime();

const CONFIG = {
  branches: { feature: 'feat/{topic}', slice: 'feat/{topic}--{slice}' },
  board: { matchBy: 'base' },
  labels: { sub: 'omni:sub', needsFix: 'omni:needs-fix' },
};

const LIMITS = { claimStaleMinutes: 60 };

const PRD = { topic: 'widgets' };

function slice(overrides: Partial<BoardSlice> = {}): BoardSlice {
  return { id: parseWorkSliceId('s1'), title: 'A slice', territory: ['a/'], wave: 1, blockedBy: [], ...overrides };
}

function pr(overrides: Partial<BoardPr> = {}): BoardPr {
  return {
    number: parsePr(1),
    title: 's1',
    headRefName: 'feat/widgets--s1',
    baseRefName: 'feat/widgets',
    state: 'OPEN',
    isDraft: false,
    mergedAt: null,
    body: '',
    labels: [],
    updatedAt: '2026-09-25T11:00:00Z',
    createdAt: '2026-09-25T11:50:00Z', // fresh by default — 10 minutes old, well under the 60-minute limit
    headCommitDate: '2026-09-25T11:50:00Z',
    ...overrides,
  };
}

function board(slices: BoardSlice[], prs: BoardPr[], overrides: { repos?: BoardRepos } = {}) {
  return boardFor({ slices, prs, now: NOW, limits: LIMITS, config: CONFIG, prd: PRD, ...overrides });
}

describe('fillBranch', () => {
  it('fills {topic} and {slice} from the given values', () => {
    expect(fillBranch('feat/{topic}--{slice}', { topic: 'widgets', slice: parseWorkSliceId('s3') })).toBe('feat/widgets--s3');
  });

  it('leaves an unfilled placeholder untouched', () => {
    expect(fillBranch('feat/{topic}--{slice}', { topic: 'widgets' })).toBe('feat/widgets--{slice}');
  });
});

describe('isClaimedStale — the stale-claim rule, exported for the Engineering board (PRD 714)', () => {
  const claim = (overrides = {}) => ({ isDraft: true, createdAt: new Date(NOW - 61 * 60_000).toISOString(), headCommitDate: new Date(NOW - 61 * 60_000).toISOString(), ...overrides });

  it('calls a draft with no commit beyond its claim, older than the limit, stale', () => {
    expect(isClaimedStale(claim(), NOW, 60)).toBe(true);
  });

  it('keeps a fresh claim, a claim with a commit beyond it, a non-draft and an unknown head date fresh', () => {
    expect(isClaimedStale(claim({ createdAt: new Date(NOW - 59 * 60_000).toISOString(), headCommitDate: new Date(NOW - 59 * 60_000).toISOString() }), NOW, 60)).toBe(false);
    expect(isClaimedStale(claim({ headCommitDate: new Date(NOW - 30 * 60_000).toISOString() }), NOW, 60)).toBe(false);
    expect(isClaimedStale(claim({ isDraft: false }), NOW, 60)).toBe(false);
    expect(isClaimedStale(claim({ headCommitDate: null }), NOW, 60)).toBe(false);
  });
});

describe('boardFor — states', () => {
  it('is merged when the matched pull request is merged', () => {
    const result = board([slice()], [pr({ state: 'MERGED', mergedAt: '2026-09-25T11:30:00Z' })]);
    expect(firstRow(result).state).toBe('merged');
  });

  it('is merged when only mergedAt says so (state shape varies by payload)', () => {
    const result = board([slice()], [pr({ mergedAt: '2026-09-25T11:30:00Z' })]);
    expect(firstRow(result).state).toBe('merged');
  });

  it('is in-flight when an open, non-draft pull request is matched', () => {
    const result = board([slice()], [pr({ isDraft: false })]);
    expect(firstRow(result).state).toBe('in-flight');
  });

  it('is in-flight when a draft pull request was claimed recently', () => {
    const result = board([slice()], [pr({ isDraft: true, createdAt: '2026-09-25T11:55:00Z', headCommitDate: '2026-09-25T11:55:00Z' })]);
    expect(firstRow(result).state).toBe('in-flight');
  });

  it('is in-flight when an old draft has moved past its claim commit, even though the claim itself is old', () => {
    const result = board(
      [slice()],
      [
        pr({
          isDraft: true,
          createdAt: '2026-09-25T08:00:00Z', // 4h old, older than the 60-minute limit
          headCommitDate: '2026-09-25T08:50:00Z', // a real commit after the claim
        }),
      ],
    );
    expect(firstRow(result).state).toBe('in-flight');
  });

  it('is in-flight — never excused into claimed-stale — when the head commit date is unknown', () => {
    const result = board(
      [slice()],
      [pr({ isDraft: true, createdAt: '2026-09-25T08:00:00Z', headCommitDate: null })],
    );
    expect(firstRow(result).state).toBe('in-flight');
  });

  it('is stuck when the needs-fix label is set, even over a stale draft', () => {
    const result = board(
      [slice()],
      [
        pr({
          isDraft: true,
          createdAt: '2026-09-25T08:00:00Z',
          headCommitDate: '2026-09-25T08:00:00Z',
          labels: [{ name: 'omni:needs-fix' }],
        }),
      ],
    );
    expect(firstRow(result).state).toBe('stuck');
  });

  it('accepts labels as plain strings too', () => {
    const result = board([slice()], [pr({ labels: ['omni:needs-fix'] })]);
    expect(firstRow(result).state).toBe('stuck');
  });

  it('is claimed-stale when a draft has moved no further than its claim and the claim is older than the limit', () => {
    const result = board(
      [slice()],
      [
        pr({
          isDraft: true,
          createdAt: '2026-09-25T08:00:00Z', // 4h old
          headCommitDate: '2026-09-25T08:00:00Z', // same moment as the claim, no push since
        }),
      ],
    );
    expect(firstRow(result).state).toBe('claimed-stale');
  });

  it('is claimed-stale even when the pull request was updated recently — staleness reads createdAt, never updatedAt', () => {
    const result = board(
      [slice()],
      [
        pr({
          isDraft: true,
          createdAt: '2026-09-25T08:00:00Z', // 4h old claim
          headCommitDate: '2026-09-25T08:00:00Z', // never pushed to since
          updatedAt: '2026-09-25T11:59:00Z', // a comment or label change bumped this a minute ago
        }),
      ],
    );
    expect(firstRow(result).state).toBe('claimed-stale');
  });

  it('is runnable when nothing blocks it and no pull request exists', () => {
    const result = board([slice({ blockedBy: [] })], []);
    expect(firstRow(result).state).toBe('runnable');
  });

  it('is runnable once every blocker is merged', () => {
    const slices = [
      slice({ id: parseWorkSliceId('s1'), wave: 1 }),
      slice({ id: parseWorkSliceId('s2'), wave: 2, blockedBy: [parseWorkSliceId('s1')] }),
    ];
    const prs = [pr({ headRefName: 'feat/widgets--s1', mergedAt: '2026-09-25T11:00:00Z' })];
    const result = board(slices, prs);
    expect(rowOf(result, 's2').state).toBe('runnable');
  });

  it('is blocked when a blocker is not merged', () => {
    const slices = [
      slice({ id: parseWorkSliceId('s1'), wave: 1 }),
      slice({ id: parseWorkSliceId('s2'), wave: 2, blockedBy: [parseWorkSliceId('s1')] }),
    ];
    const result = board(slices, []);
    expect(rowOf(result, 's2').state).toBe('blocked');
  });

  it('is blocked when the blocker id names no slice at all — never guessed runnable', () => {
    const result = board([slice({ blockedBy: [parseWorkSliceId('ghost')] })], []);
    expect(firstRow(result).state).toBe('blocked');
  });

  it('treats a closed, never-merged pull request as a dropped claim — the slice reads as if none existed', () => {
    const result = board([slice()], [pr({ state: 'CLOSED', mergedAt: null })]);
    expect(firstRow(result).state).toBe('runnable');
    expect(firstRow(result).pr).toBeNull();
  });
});

describe('boardFor — matching', () => {
  it('does not match a pull request on a different head branch', () => {
    const result = board([slice()], [pr({ headRefName: 'feat/widgets--s2' })]);
    expect(firstRow(result).state).toBe('runnable');
    expect(firstRow(result).pr).toBeNull();
  });

  it('matchBy "base": ignores a same-named branch whose base is not the feature branch', () => {
    const result = board([slice()], [pr({ baseRefName: 'main' })]);
    expect(firstRow(result).state).toBe('runnable');
  });

  it('matchBy "label": matches by labels.sub instead of the base branch', () => {
    const config = { ...CONFIG, board: { matchBy: 'label' } };
    const result = boardFor({
      slices: [slice()],
      prs: [pr({ baseRefName: 'main', labels: [{ name: 'omni:sub' }] })],
      now: NOW,
      limits: LIMITS,
      config,
      prd: PRD,
    });
    expect(firstRow(result).state).toBe('in-flight');
  });

  it('matchBy "label": a same-named branch with no sub label is not matched', () => {
    const config = { ...CONFIG, board: { matchBy: 'label' } };
    const result = boardFor({
      slices: [slice()],
      prs: [pr({ baseRefName: 'main', labels: [] })],
      now: NOW,
      limits: LIMITS,
      config,
      prd: PRD,
    });
    expect(firstRow(result).state).toBe('runnable');
  });

  it('prefers a merged candidate over an open one for the same slice', () => {
    const prs = [
      pr({ number: parsePr(1), state: 'OPEN', updatedAt: '2026-09-25T11:59:00Z' }),
      pr({ number: parsePr(2), mergedAt: '2026-09-25T10:00:00Z', updatedAt: '2026-09-25T10:05:00Z' }),
    ];
    const result = board([slice()], prs);
    expect(firstRow(result).state).toBe('merged');
    expect(prOf(firstRow(result)).number).toBe(2);
  });

  it('prefers the most recently updated candidate among ties', () => {
    const prs = [
      pr({ number: parsePr(1), state: 'CLOSED', mergedAt: null, updatedAt: '2026-09-25T09:00:00Z' }),
      pr({ number: parsePr(2), state: 'OPEN', updatedAt: '2026-09-25T11:00:00Z' }),
    ];
    const result = board([slice()], prs);
    expect(prOf(firstRow(result)).number).toBe(2);
  });
});

describe('runnableFrontier', () => {
  function row(overrides: Partial<FrontierRow>): FrontierRow {
    return { id: parseWorkSliceId('s1'), territory: ['a/'], wave: 1, state: 'runnable', ...overrides };
  }

  it('is empty when nothing is runnable or claimed-stale', () => {
    expect(runnableFrontier([row({ state: 'blocked' })])).toEqual({
      wave: null,
      runnable: [],
      takeable: [],
      excluded: [],
      collisions: [],
    });
  });

  it('is the lowest wave that still has a runnable slice', () => {
    const rows = [
      row({ id: parseWorkSliceId('s1'), wave: 1, state: 'merged' }),
      row({ id: parseWorkSliceId('s2'), wave: 2, territory: ['b/'] }),
      row({ id: parseWorkSliceId('s3'), wave: 3, territory: ['c/'] }),
    ];
    const frontier = runnableFrontier(rows);
    expect(frontier.wave).toBe(2);
    expect(frontier.takeable).toEqual(['s2']);
    expect(frontier.runnable).toEqual(['s2']);
  });

  it('takeable includes a claimed-stale slice — the kit reclaims a cold claim itself', () => {
    const rows = [row({ id: parseWorkSliceId('s1'), wave: 1, state: 'claimed-stale' })];
    const frontier = runnableFrontier(rows);
    expect(frontier.wave).toBe(1);
    expect(frontier.takeable).toEqual(['s1']);
    expect(frontier.runnable).toEqual([]);
  });

  it('a claimed-stale slice can set the frontier wave even with no plain-runnable slice there', () => {
    const rows = [
      row({ id: parseWorkSliceId('s1'), wave: 1, state: 'claimed-stale' }),
      row({ id: parseWorkSliceId('s2'), wave: 2, state: 'runnable', territory: ['b/'] }),
    ];
    const frontier = runnableFrontier(rows);
    expect(frontier.wave).toBe(1);
    expect(frontier.takeable).toEqual(['s1']);
  });

  it('defers only the later of a colliding pair, in plan order — never drops both', () => {
    const rows = [
      row({ id: parseWorkSliceId('s1'), wave: 1, territory: ['shared/'] }),
      row({ id: parseWorkSliceId('s2'), wave: 1, territory: ['shared/'] }),
      row({ id: parseWorkSliceId('s3'), wave: 1, territory: ['other/'] }),
    ];
    const frontier = runnableFrontier(rows);
    expect(frontier.wave).toBe(1);
    expect(frontier.takeable.sort()).toEqual(['s1', 's3']);
    expect(frontier.runnable.sort()).toEqual(['s1', 's3']);
    expect(frontier.excluded).toEqual(['s2']);
    expect(frontier.collisions).toHaveLength(1);
  });

  it('order in `rows` is plan order — the row that comes first is the one kept', () => {
    const rows = [
      row({ id: parseWorkSliceId('s2'), wave: 1, territory: ['shared/'] }),
      row({ id: parseWorkSliceId('s1'), wave: 1, territory: ['shared/'] }),
    ];
    const frontier = runnableFrontier(rows);
    expect(frontier.takeable).toEqual(['s2']);
    expect(frontier.excluded).toEqual(['s1']);
  });

  it('reads the frontier straight off boardFor’s own rows', () => {
    const slices = [
      slice({ id: parseWorkSliceId('s1'), wave: 1, territory: ['a/'] }),
      slice({ id: parseWorkSliceId('s2'), wave: 2, territory: ['b/'], blockedBy: [parseWorkSliceId('s1')] }),
    ];
    const result = board(slices, [pr({ headRefName: 'feat/widgets--s1', mergedAt: '2026-09-25T11:00:00Z' })]);
    expect(result.frontier).toEqual({ wave: 2, runnable: ['s2'], takeable: ['s2'], excluded: [], collisions: [] });
  });
});

describe('boardFor — a plan repository (PRD 563)', () => {
  const REPOS = {
    'widgets-plan': { slug: 'acme/widgets-plan', readable: true },
    backend: { slug: 'acme/backend', readable: true },
    frontend: { slug: 'acme/frontend', readable: true },
  };

  function multi(slices: BoardSlice[], prs: BoardPr[], repos: BoardRepos = REPOS) {
    return board(slices, prs, { repos });
  }

  it('gives every row its repo and slug', () => {
    const result = multi([slice({ repo: 'backend' }), slice({ id: parseWorkSliceId('s2'), repo: 'widgets-plan' })], []);
    expect(result.slices.map(({ id, repo, slug }) => ({ id, repo, slug }))).toEqual([
      { id: 's1', repo: 'backend', slug: 'acme/backend' },
      { id: 's2', repo: 'widgets-plan', slug: 'acme/widgets-plan' },
    ]);
  });

  it('matches a slice only to a pull request of its own repository', () => {
    const result = multi(
      [slice({ id: parseWorkSliceId('s1'), repo: 'backend' }), slice({ id: parseWorkSliceId('s2'), repo: 'frontend', territory: ['b/'] })],
      [
        pr({ number: parsePr(10), slug: 'acme/frontend', headRefName: 'feat/widgets--s1', state: 'MERGED', mergedAt: '2026-09-25T11:30:00Z' }),
        pr({ number: parsePr(11), slug: 'acme/backend', headRefName: 'feat/widgets--s2', state: 'MERGED', mergedAt: '2026-09-25T11:30:00Z' }),
      ],
    );
    expect(result.slices.map((row) => [row.id, row.state, row.pr])).toEqual([
      ['s1', 'runnable', null],
      ['s2', 'runnable', null],
    ]);
  });

  it('matches the same slice branch name in two repositories to two different slices', () => {
    const slices = [slice({ id: parseWorkSliceId('s1'), repo: 'backend' }), slice({ id: parseWorkSliceId('s1'), repo: 'frontend', territory: ['b/'] })];
    const result = multi(slices, [
      pr({ number: parsePr(10), slug: 'acme/backend', state: 'MERGED', mergedAt: '2026-09-25T11:30:00Z' }),
      pr({ number: parsePr(20), slug: 'acme/frontend' }),
    ]);
    expect(result.slices.map((row) => [row.repo, row.state, prOf(row).number])).toEqual([
      ['backend', 'merged', 10],
      ['frontend', 'in-flight', 20],
    ]);
  });

  it('reads a slice blocked by a merged slice of another repository as runnable, and the frontier across repositories', () => {
    const result = multi(
      [
        slice({ id: parseWorkSliceId('s1'), repo: 'backend', wave: 1 }),
        slice({ id: parseWorkSliceId('s2'), repo: 'frontend', wave: 2, blockedBy: [parseWorkSliceId('s1')] }),
        slice({ id: parseWorkSliceId('s3'), repo: 'widgets-plan', wave: 2, territory: ['c/'] }),
      ],
      [pr({ slug: 'acme/backend', state: 'MERGED', mergedAt: '2026-09-25T11:30:00Z' })],
    );
    expect(result.slices.map((row) => row.state)).toEqual(['merged', 'runnable', 'runnable']);
    expect(result.frontier).toMatchObject({ wave: 2, takeable: ['s2', 's3'] });
  });

  it('makes the slices of a repository it cannot read unreadable, and holds what they block', () => {
    const result = multi(
      [
        slice({ id: parseWorkSliceId('s1'), repo: 'backend', wave: 1 }),
        slice({ id: parseWorkSliceId('s2'), repo: 'frontend', wave: 1, territory: ['b/'] }),
        slice({ id: parseWorkSliceId('s3'), repo: 'widgets-plan', wave: 2, blockedBy: [parseWorkSliceId('s1')] }),
      ],
      [],
      { ...REPOS, backend: { slug: 'acme/backend', readable: false } },
    );
    expect(result.slices.map((row) => [row.id, row.state])).toEqual([
      ['s1', 'unreadable'],
      ['s2', 'runnable'],
      ['s3', 'blocked'],
    ]);
    expect(result.frontier).toMatchObject({ wave: 1, takeable: ['s2'] });
  });

  it('makes a slice naming a repository it does not know unreadable, with no slug', () => {
    const result = multi([slice({ repo: 'nowhere' })], []);
    expect(result.slices[0]).toMatchObject({ repo: 'nowhere', slug: null, state: 'unreadable' });
  });

  it('gives rows no repo or slug on a plan without a repo column', () => {
    const result = board([slice({ repo: null })], [pr()]);
    expect(result.slices[0]).not.toHaveProperty('repo');
    expect(result.slices[0]).not.toHaveProperty('slug');
    expect(firstRow(result).state).toBe('in-flight');
  });
});

describe('landings: the board reads a PRD per landing', () => {
  const LANDINGS: BoardLanding[] = [
    { landing: 1, name: 'expand', branch: 'feat/widgets-1of3-expand' },
    { landing: 2, name: 'code', branch: 'feat/widgets-2of3-code' },
    { landing: 3, name: 'contract', branch: 'feat/widgets-3of3-contract' },
  ];
  const SLICES = [
    slice({ id: parseWorkSliceId('s1'), territory: ['db/'], landing: 1 }),
    slice({ id: parseWorkSliceId('s2'), territory: ['src/'], landing: 2 }),
    slice({ id: parseWorkSliceId('s3'), territory: ['app/'], landing: 2, wave: 2, blockedBy: [parseWorkSliceId('s2')] }),
    slice({ id: parseWorkSliceId('s4'), territory: ['db/'], landing: 3 }),
  ];
  const sub = (id: string, landing: number, overrides: Partial<BoardPr> = {}) =>
    pr({ number: parsePr(10 + Number(id.slice(1))), headRefName: `feat/widgets--${id}`, baseRefName: LANDINGS[landing - 1]?.branch, ...overrides });
  const MERGED = { state: 'MERGED', mergedAt: '2026-09-25T10:00:00Z' };
  const run = (prs: BoardPr[], config = CONFIG) =>
    boardFor({ slices: SLICES, prs, now: NOW, limits: LIMITS, config, prd: PRD, landings: LANDINGS });

  it('attributes every sub-PR to its landing by base branch', () => {
    const result = run([sub('s1', 1, MERGED), sub('s2', 2), sub('s4', 3)]);
    expect(result.slices.map((row) => [row.id, row.state, row.pr?.number ?? null])).toEqual([
      ['s1', 'merged', 11],
      ['s2', 'in-flight', 12],
      ['s3', 'blocked', null],
      ['s4', 'in-flight', 14],
    ]);
    // A sub-PR into another landing's branch is not its slice's.
    expect(rowOf(run([sub('s2', 1)]), 's2').state).toBe('runnable');
  });

  it('in label mode, counts a labelled PR into its landing branch and no labelled PR into another', () => {
    const config = { ...CONFIG, board: { matchBy: 'label' } };
    const labels = [{ name: 'omni:sub' }];
    expect(rowOf(run([sub('s2', 2, { labels })], config), 's2').state).toBe('in-flight');
    expect(rowOf(run([sub('s2', 2, { labels, baseRefName: 'main' })], config), 's2').state).toBe('runnable');
    expect(rowOf(run([sub('s2', 2)], config), 's2').state).toBe('runnable');
  });

  it('names the current landing: the first whose slices are not all merged, and none at the end', () => {
    const first = run([]);
    expect(first.currentLanding).toBe(1);
    expect(first.frontier.takeable).toEqual(['s1']);

    const second = run([sub('s1', 1, MERGED)]);
    expect(second.currentLanding).toBe(2);
    expect(second.frontier.takeable).toEqual(['s2']);

    const done = run([sub('s1', 1, MERGED), sub('s2', 2, MERGED), sub('s3', 2, MERGED), sub('s4', 3, MERGED)]);
    expect(done.currentLanding).toBeNull();
    expect(done.frontier.wave).toBeNull();
  });

  it("reports each landing's counts and its own pull request's state", () => {
    const own = (landing: number, overrides: Partial<BoardPr>) =>
      pr({ number: parsePr(100 + landing), headRefName: LANDINGS[landing - 1]?.branch, baseRefName: 'main', ...overrides });
    const result = run([
      sub('s1', 1, MERGED),
      sub('s2', 2),
      own(1, MERGED),
      own(2, { isDraft: false }),
      own(3, { isDraft: true }),
    ]);
    expect(result.landings?.map(({ landing, merged, open, notStarted, complete, pr: landingPr }) => ({ landing, merged, open, notStarted, complete, pr: landingPr }))).toEqual([
      { landing: 1, merged: 1, open: 0, notStarted: 0, complete: true, pr: { number: 101, state: 'merged', base: 'main' } },
      { landing: 2, merged: 0, open: 1, notStarted: 1, complete: false, pr: { number: 102, state: 'ready', base: 'main' } },
      { landing: 3, merged: 0, open: 0, notStarted: 1, complete: false, pr: { number: 103, state: 'draft', base: 'main' } },
    ]);
    expect(run([]).landings?.map((landing) => landing.pr)).toEqual([
      { number: null, state: 'absent', base: null },
      { number: null, state: 'absent', base: null },
      { number: null, state: 'absent', base: null },
    ]);
  });

  it('gives a PRD of one landing the board it always had, with no landings key', () => {
    const result = board([slice()], [pr()]);
    expect(Object.keys(result)).toEqual(['prd', 'slices', 'frontier']);
    const one = boardFor({ slices: [slice()], prs: [pr()], now: NOW, limits: LIMITS, config: CONFIG, prd: PRD, landings: [{ landing: 1, name: 'x', branch: 'feat/widgets' }] });
    expect(one).toEqual(result);
  });
});

describe('landingBranches', () => {
  const BRANCHES = { feature: 'feat/{topic}', landing: 'feat/{topic}-{landing}of{landings}-{name}' };

  it('keeps the feature branch for a PRD of one landing', () => {
    expect(landingBranches(BRANCHES, { topic: 'widgets', landings: [{ landing: 1, name: 'landing-1' }] })).toEqual([
      { landing: 1, name: 'landing-1', branch: 'feat/widgets' },
    ]);
  });

  it('fills branches.landing for each landing of more than one', () => {
    expect(
      landingBranches(BRANCHES, { topic: 'widgets', landings: [{ landing: 1, name: 'expand' }, { landing: 2, name: 'code' }] }).map((entry) => entry.branch),
    ).toEqual(['feat/widgets-1of2-expand', 'feat/widgets-2of2-code']);
  });
});

describe('landings in a plan repository: one chain per target', () => {
  const REPOS: BoardRepos = { api: { slug: 'acme/api', readable: true }, web: { slug: 'acme/web', readable: true } };
  // Landing 1 (the migrations) lands in the back-end only; landing 2 in both.
  const SLICES = [
    slice({ id: parseWorkSliceId('s1'), territory: ['db/'], landing: 1, repo: 'api' }),
    slice({ id: parseWorkSliceId('s2'), territory: ['src/'], landing: 2, repo: 'api' }),
    slice({ id: parseWorkSliceId('s3'), territory: ['app/'], landing: 2, repo: 'web' }),
  ];
  const LANDINGS: BoardLanding[] = [
    { landing: 1, name: 'expand', branch: 'feat/widgets-1of2-expand', repo: 'api' },
    { landing: 2, name: 'code', branch: 'feat/widgets-2of2-code', repo: 'api' },
    { landing: 2, name: 'code', branch: 'feat/widgets', repo: 'web' },
  ];
  const run = (prs: BoardPr[]) => boardFor({ slices: SLICES, prs, now: NOW, limits: LIMITS, config: CONFIG, prd: PRD, repos: REPOS, landings: LANDINGS });

  it("takes a target's landing 2 only once that target's landing 1 is merged, and never holds one target on another", () => {
    const first = run([]);
    expect(first.frontier.takeable).toEqual(['s1', 's3']);
    expect(first.landings?.map(({ repo, landing, current }) => [repo, landing, current])).toEqual([
      ['api', 1, true],
      ['api', 2, false],
      ['web', 2, true],
    ]);

    const merged = run([pr({ headRefName: 'feat/widgets--s1', baseRefName: 'feat/widgets-1of2-expand', state: 'MERGED', mergedAt: '2026-09-25T10:00:00Z', slug: 'acme/api' })]);
    expect(merged.frontier.takeable).toEqual(['s2', 's3']);
  });

  it("matches a sub-PR to its own repository's landing branch, and a landing PR by its repository", () => {
    const result = run([
      pr({ number: parsePr(3), headRefName: 'feat/widgets--s3', baseRefName: 'feat/widgets', slug: 'acme/web' }),
      pr({ number: parsePr(9), headRefName: 'feat/widgets', baseRefName: 'main', isDraft: true, slug: 'acme/web' }),
      pr({ number: parsePr(8), headRefName: 'feat/widgets', baseRefName: 'main', slug: 'acme/api' }),
    ]);
    expect(rowOf(result, 's3').state).toBe('in-flight');
    expect(result.landings?.find((row) => row.repo === 'web')?.pr).toEqual({ number: 9, state: 'draft', base: 'main' });
  });
});
