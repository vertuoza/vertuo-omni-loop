/**
 * **The Reviewer's reviews a pull request already carries** (PRD 2871, s1), read back by the marker
 * each one opens on (`./verdict.ts`): a round is posted once, and the latest round is the one a
 * mission and the next round act on. A review without the marker (a person's) is never one of them.
 *
 * Pure: it reads the reviews it is handed, as GitHub lists them.
 */
import { readReviewMarker } from './verdict.ts';
import type { VerdictName } from './verdict.ts';

/** One review of a pull request, the fields read here. */
export type ListedReview = { id: number; body?: string | null | undefined; html_url?: string | null | undefined };

/** A review the Reviewer posted: its round, its verdict and its link. */
export type PostedReview = { round: number; verdict: VerdictName; url: string | null };

/** Every review of `reviews` that carries the marker, in GitHub's order. */
function postedReviews(reviews: readonly ListedReview[]): PostedReview[] {
  return reviews.flatMap((review) => {
    const marker = readReviewMarker(review.body);
    return marker ? [{ ...marker, url: review.html_url ?? null }] : [];
  });
}

/** The review that already posted `round`, or `null`. */
export function postedRound(reviews: readonly ListedReview[], round: number): PostedReview | null {
  return postedReviews(reviews).find((review) => review.round === round) ?? null;
}

/** The latest round posted: the highest, the last listed of it when posted twice; `null` when none was. */
export function latestReview(reviews: readonly ListedReview[]): PostedReview | null {
  let latest: PostedReview | null = null;
  for (const review of postedReviews(reviews)) if (!latest || review.round >= latest.round) latest = review;
  return latest;
}
