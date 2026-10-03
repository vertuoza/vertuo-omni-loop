import { describe, expect, it, vi } from 'vitest';
import { brokenRows } from '../data/broken-rows.fake';

vi.mock('server-only', () => ({}));

const { StoredPullRequest, StoredReview, TrackedRepository } = await import('./profile');

// The profile's schemas (PRD 1030): a pull request, a review and a tracked repository as the profile's
// selects read them, each parsed, and refused with a column missing, of the wrong type, or null.

const PULL_REQUEST = {
  repo: 'acme/widgets', number: 7, author: 'ada', author_is_bot: false, opened_at: '2026-09-20T09:00:00Z', merged_at: '2026-09-21T09:00:00Z',
  closed_at: '2026-09-21T09:00:00Z', merged_by: 'bob', commits: 3, additions: 40, deletions: 2, omni_signed: true,
};
const REVIEW = { repo: 'acme/widgets', number: 7, reviewer: 'bob', first_at: '2026-09-20T12:00:00Z' };

describe('the profile\'s schemas', () => {
  it('parse a pull request, and refuse a broken one', () => {
    expect(StoredPullRequest.parse(PULL_REQUEST)).toEqual(PULL_REQUEST);
    expect(StoredPullRequest.parse({ ...PULL_REQUEST, author: null, merged_at: null, closed_at: null, merged_by: null })).toMatchObject({ author: null });
    for (const [how, row] of brokenRows(PULL_REQUEST, { missing: 'omni_signed', wrongType: ['additions', '40'], notNull: 'opened_at' })) {
      expect(StoredPullRequest.safeParse(row).success, how).toBe(false);
    }
  });

  it('parse a review, and refuse a broken one', () => {
    expect(StoredReview.parse(REVIEW)).toEqual(REVIEW);
    for (const [how, row] of brokenRows(REVIEW, { missing: 'first_at', wrongType: ['number', '7'], notNull: 'reviewer' })) {
      expect(StoredReview.safeParse(row).success, how).toBe(false);
    }
  });

  it('parse a tracked repository\'s name, and refuse a broken one', () => {
    expect(TrackedRepository.parse({ full_name: 'acme/widgets' })).toEqual({ full_name: 'acme/widgets' });
    for (const [how, row] of brokenRows({ full_name: 'acme/widgets' }, { missing: 'full_name', wrongType: ['full_name', 7], notNull: 'full_name' })) {
      expect(TrackedRepository.safeParse(row).success, how).toBe(false);
    }
  });
});
