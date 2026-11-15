// PRD 2871, s1: the Reviewer's reviews a pull request carries, read back by their marker.
import { describe, expect, it } from 'vitest';
import { latestReview, postedRound } from './posted.ts';

const review = (id: number, body: string | null) => ({ id, body, html_url: `https://github.com/acme/widgets/pull/9#pullrequestreview-${String(id)}` });
const url = (id: number) => `https://github.com/acme/widgets/pull/9#pullrequestreview-${String(id)}`;

describe('postedRound', () => {
  it('finds the review that posted a round, and none for a round not posted', () => {
    const reviews = [review(1, 'A person’s review.'), review(2, '<!-- omni-review: 1 changes -->')];
    expect(postedRound(reviews, 1)).toEqual({ round: 1, verdict: 'changes', url: url(2) });
    expect(postedRound(reviews, 2)).toBeNull();
  });

  it('reads a review with no body, or no link, as GitHub may list one', () => {
    expect(postedRound([review(1, null)], 1)).toBeNull();
    expect(postedRound([{ id: 3, body: '<!-- omni-review: 2 pass -->' }], 2)).toEqual({ round: 2, verdict: 'pass', url: null });
  });
});

describe('latestReview', () => {
  it('is the highest round, whatever the order, and the last listed when a round was posted twice', () => {
    expect(latestReview([review(5, '<!-- omni-review: 2 changes -->'), review(4, '<!-- omni-review: 1 changes -->')])).toMatchObject({ round: 2, url: url(5) });
    expect(latestReview([review(4, '<!-- omni-review: 1 changes -->'), review(6, '<!-- omni-review: 1 pass -->')])).toMatchObject({ round: 1, verdict: 'pass', url: url(6) });
  });

  it('is null when no review carries the marker', () => {
    expect(latestReview([])).toBeNull();
    expect(latestReview([review(1, 'LGTM')])).toBeNull();
  });
});
