import { describe, expect, it } from 'vitest';
import { decideStale } from './settle-head.mjs';

describe('decideStale', () => {
  it('is fresh when the pull request head still matches this run', () => {
    expect(decideStale('abc123', 'abc123', '')).toBe('fresh');
  });

  it('is stale when the pull request has moved to a newer head', () => {
    expect(decideStale('abc123', 'def456', '')).toBe('stale');
  });

  // The fail-open rule: a run must never SKIP its checks because a network call happened to fail.
  it('is fresh when the head could not be read, even though it looks different', () => {
    expect(decideStale('abc123', 'def456', 'gh api repos/x/pulls/1 failed')).toBe('fresh');
  });

  it('is fresh when the head came back empty', () => {
    expect(decideStale('abc123', '', '')).toBe('fresh');
  });

  it('is fresh when both an error and an empty head are somehow reported', () => {
    expect(decideStale('abc123', '', 'timeout')).toBe('fresh');
  });
});
