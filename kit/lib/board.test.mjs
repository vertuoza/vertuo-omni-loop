import { describe, expect, it } from 'vitest';
import { boardFor, runnableFrontier } from './board.mjs';

const NOW = new Date('2026-09-25T12:00:00Z').getTime();

const CONFIG = {
  branches: { feature: 'feat/{topic}', slice: 'feat/{topic}--{slice}' },
  board: { matchBy: 'base' },
  labels: { sub: 'pr:sub', needsFix: 'pr:needs-fix' },
};

const LIMITS = { claimStaleMinutes: 60 };

const PRD = { topic: 'widgets' };

function slice(overrides = {}) {
  return { id: 's1', title: 'A slice', territory: ['a/'], wave: 1, blockedBy: [], ...overrides };
}

function pr(overrides = {}) {
  return {
    number: 1,
    title: 's1',
    headRefName: 'feat/widgets--s1',
    baseRefName: 'feat/widgets',
    state: 'OPEN',
    isDraft: false,
    mergedAt: null,
    body: '',
    labels: [],
    updatedAt: '2026-09-25T11:00:00Z',
    createdAt: '2026-09-25T10:00:00Z',
    headCommitDate: '2026-09-25T10:00:00Z',
    ...overrides,
  };
}

function board(slices, prs, overrides = {}) {
  return boardFor({ slices, prs, now: NOW, limits: LIMITS, config: CONFIG, prd: PRD, ...overrides });
}

describe('boardFor — states', () => {
  it('is merged when the matched pull request is merged', () => {
    const result = board([slice()], [pr({ state: 'MERGED', mergedAt: '2026-09-25T11:30:00Z' })]);
    expect(result.slices[0].state).toBe('merged');
  });

  it('is merged when only mergedAt says so (state shape varies by payload)', () => {
    const result = board([slice()], [pr({ mergedAt: '2026-09-25T11:30:00Z' })]);
    expect(result.slices[0].state).toBe('merged');
  });

  it('is in-flight when an open, non-draft pull request is matched', () => {
    const result = board([slice()], [pr({ isDraft: false })]);
    expect(result.slices[0].state).toBe('in-flight');
  });

  it('is in-flight when a draft pull request was updated recently', () => {
    const result = board([slice()], [pr({ isDraft: true, updatedAt: '2026-09-25T11:55:00Z' })]);
    expect(result.slices[0].state).toBe('in-flight');
  });

  it('is in-flight when an old draft has moved past its claim commit, even though it is old', () => {
    const result = board(
      [slice()],
      [
        pr({
          isDraft: true,
          updatedAt: '2026-09-25T09:00:00Z', // 3h old, older than the 60-minute limit
          createdAt: '2026-09-25T08:00:00Z',
          headCommitDate: '2026-09-25T08:50:00Z', // a real commit after the claim
        }),
      ],
    );
    expect(result.slices[0].state).toBe('in-flight');
  });

  it('is stuck when the needs-fix label is set, even over a stale draft', () => {
    const result = board(
      [slice()],
      [pr({ isDraft: true, updatedAt: '2026-09-25T09:00:00Z', labels: [{ name: 'pr:needs-fix' }] })],
    );
    expect(result.slices[0].state).toBe('stuck');
  });

  it('accepts labels as plain strings too', () => {
    const result = board([slice()], [pr({ labels: ['pr:needs-fix'] })]);
    expect(result.slices[0].state).toBe('stuck');
  });

  it('is claimed-stale when a draft has sat untouched past the limit with no commit beyond the claim', () => {
    const result = board(
      [slice()],
      [
        pr({
          isDraft: true,
          updatedAt: '2026-09-25T09:00:00Z', // 3h old
          createdAt: '2026-09-25T08:59:00Z',
          headCommitDate: '2026-09-25T08:59:00Z', // same moment as the claim, no push since
        }),
      ],
    );
    expect(result.slices[0].state).toBe('claimed-stale');
  });

  it('is claimed-stale (never excused) when the head commit date is unknown', () => {
    const result = board(
      [slice()],
      [pr({ isDraft: true, updatedAt: '2026-09-25T09:00:00Z', headCommitDate: null, createdAt: null })],
    );
    expect(result.slices[0].state).toBe('claimed-stale');
  });

  it('is runnable when nothing blocks it and no pull request exists', () => {
    const result = board([slice({ blockedBy: [] })], []);
    expect(result.slices[0].state).toBe('runnable');
  });

  it('is runnable once every blocker is merged', () => {
    const slices = [
      slice({ id: 's1', wave: 1 }),
      slice({ id: 's2', wave: 2, blockedBy: ['s1'] }),
    ];
    const prs = [pr({ headRefName: 'feat/widgets--s1', mergedAt: '2026-09-25T11:00:00Z' })];
    const result = board(slices, prs);
    expect(result.slices.find((row) => row.id === 's2').state).toBe('runnable');
  });

  it('is blocked when a blocker is not merged', () => {
    const slices = [
      slice({ id: 's1', wave: 1 }),
      slice({ id: 's2', wave: 2, blockedBy: ['s1'] }),
    ];
    const result = board(slices, []);
    expect(result.slices.find((row) => row.id === 's2').state).toBe('blocked');
  });

  it('is blocked when the blocker id names no slice at all — never guessed runnable', () => {
    const result = board([slice({ blockedBy: ['ghost'] })], []);
    expect(result.slices[0].state).toBe('blocked');
  });

  it('treats a closed, never-merged pull request as a dropped claim — the slice reads as if none existed', () => {
    const result = board([slice()], [pr({ state: 'CLOSED', mergedAt: null })]);
    expect(result.slices[0].state).toBe('runnable');
    expect(result.slices[0].pr).toBeNull();
  });
});

describe('boardFor — matching', () => {
  it('does not match a pull request on a different head branch', () => {
    const result = board([slice()], [pr({ headRefName: 'feat/widgets--s2' })]);
    expect(result.slices[0].state).toBe('runnable');
    expect(result.slices[0].pr).toBeNull();
  });

  it('matchBy "base": ignores a same-named branch whose base is not the feature branch', () => {
    const result = board([slice()], [pr({ baseRefName: 'main' })]);
    expect(result.slices[0].state).toBe('runnable');
  });

  it('matchBy "label": matches by labels.sub instead of the base branch', () => {
    const config = { ...CONFIG, board: { matchBy: 'label' } };
    const result = boardFor({
      slices: [slice()],
      prs: [pr({ baseRefName: 'main', labels: [{ name: 'pr:sub' }] })],
      now: NOW,
      limits: LIMITS,
      config,
      prd: PRD,
    });
    expect(result.slices[0].state).toBe('in-flight');
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
    expect(result.slices[0].state).toBe('runnable');
  });

  it('prefers a merged candidate over an open one for the same slice', () => {
    const prs = [
      pr({ number: 1, state: 'OPEN', updatedAt: '2026-09-25T11:59:00Z' }),
      pr({ number: 2, mergedAt: '2026-09-25T10:00:00Z', updatedAt: '2026-09-25T10:05:00Z' }),
    ];
    const result = board([slice()], prs);
    expect(result.slices[0].state).toBe('merged');
    expect(result.slices[0].pr.number).toBe(2);
  });

  it('prefers the most recently updated candidate among ties', () => {
    const prs = [
      pr({ number: 1, state: 'CLOSED', mergedAt: null, updatedAt: '2026-09-25T09:00:00Z' }),
      pr({ number: 2, state: 'OPEN', updatedAt: '2026-09-25T11:00:00Z' }),
    ];
    const result = board([slice()], prs);
    expect(result.slices[0].pr.number).toBe(2);
  });
});

describe('runnableFrontier', () => {
  function row(overrides) {
    return { id: 's1', territory: ['a/'], wave: 1, state: 'runnable', ...overrides };
  }

  it('is empty when nothing is runnable', () => {
    expect(runnableFrontier([row({ state: 'blocked' })])).toEqual({
      wave: null,
      slices: [],
      excluded: [],
      collisions: [],
    });
  });

  it('is the lowest wave that still has a runnable slice', () => {
    const rows = [
      row({ id: 's1', wave: 1, state: 'merged' }),
      row({ id: 's2', wave: 2, territory: ['b/'] }),
      row({ id: 's3', wave: 3, territory: ['c/'] }),
    ];
    const frontier = runnableFrontier(rows);
    expect(frontier.wave).toBe(2);
    expect(frontier.slices).toEqual(['s2']);
  });

  it('excludes a pair that shares territory in the frontier wave', () => {
    const rows = [
      row({ id: 's1', wave: 1, territory: ['shared/'] }),
      row({ id: 's2', wave: 1, territory: ['shared/'] }),
      row({ id: 's3', wave: 1, territory: ['other/'] }),
    ];
    const frontier = runnableFrontier(rows);
    expect(frontier.wave).toBe(1);
    expect(frontier.slices).toEqual(['s3']);
    expect(frontier.excluded.sort()).toEqual(['s1', 's2']);
    expect(frontier.collisions).toHaveLength(1);
  });

  it('reads the frontier straight off boardFor’s own rows', () => {
    const slices = [
      slice({ id: 's1', wave: 1, territory: ['a/'] }),
      slice({ id: 's2', wave: 2, territory: ['b/'], blockedBy: ['s1'] }),
    ];
    const result = board(slices, [pr({ headRefName: 'feat/widgets--s1', mergedAt: '2026-09-25T11:00:00Z' })]);
    expect(result.frontier).toEqual({ wave: 2, slices: ['s2'], excluded: [], collisions: [] });
  });
});
