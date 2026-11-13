/**
 * **Scoring a set of searches** (PRD omni-loop-8, slice s2). Pure: no clock, no network, no store.
 * Each question brings the ids a search ranked (best first), the ids that are its right answers and
 * its category; {@link scoreSearches} answers top@1, top@5, recall@5, recall@10 and the mean
 * reciprocal rank, overall and per category, plus the questions whose right answer is not in the
 * top 5 (the misses). `scripts/eval-search.ts` (`pnpm eval:search`) and the GitHub App's
 * `search-eval-run` job score with this one function, so their numbers agree.
 *
 * A question with no right answer cannot be hit or missed: it is left out of every measure (and of
 * the question count), and counted in `skipped`.
 */

/** One question's search: what ranked, what is right, which category it belongs to. */
export type SearchOutcome = {
  /** The question's own id, carried to its miss; free for the caller. */
  id?: string;
  category: string;
  /** The ids the search returned, best first. */
  ranked: readonly string[];
  /** The ids that answer the question. */
  right: readonly string[];
};

/** The measures of a group of questions, each a share from 0 to 1. */
export type Measures = {
  /** The questions that counted (those with at least one right answer). */
  questions: number;
  top1: number;
  top5: number;
  recall5: number;
  recall10: number;
  /** Mean over the questions of 1 / (rank of the first right answer), 0 when none came up. */
  mrr: number;
};

/** A question whose right answer is not in the top 5. */
export type Miss = {
  id?: string;
  category: string;
  /** Where the best-placed right answer ranked (1 is first), or null when none came up. */
  rank: number | null;
  /** The ids that came first (the top 5). */
  first: string[];
  right: string[];
};

export type SearchScores = {
  overall: Measures;
  /** One entry per category, in the order the categories first appear. */
  byCategory: { category: string; measures: Measures }[];
  misses: Miss[];
  /** Questions left out for having no right answer. */
  skipped: number;
};

const MISS_TOP = 5;

/** The rank (1 is first) of the best-placed right answer, or null. */
function bestRank(ranked: readonly string[], right: ReadonlySet<string>): number | null {
  const at = ranked.findIndex((id) => right.has(id));
  return at < 0 ? null : at + 1;
}

/** The share of the distinct right answers that sit in the first `k` ranked ids. */
function recallAt(ranked: readonly string[], right: ReadonlySet<string>, k: number): number {
  const found = new Set(ranked.slice(0, k).filter((id) => right.has(id)));
  return found.size / right.size;
}

function measure(group: readonly SearchOutcome[]): Measures {
  const sums = { top1: 0, top5: 0, recall5: 0, recall10: 0, mrr: 0 };
  for (const q of group) {
    const right = new Set(q.right);
    const rank = bestRank(q.ranked, right);
    if (rank === 1) sums.top1 += 1;
    if (rank !== null && rank <= 5) sums.top5 += 1;
    sums.recall5 += recallAt(q.ranked, right, 5);
    sums.recall10 += recallAt(q.ranked, right, 10);
    if (rank !== null) sums.mrr += 1 / rank;
  }
  const n = group.length;
  const mean = (sum: number): number => (n === 0 ? 0 : sum / n);
  return { questions: n, top1: mean(sums.top1), top5: mean(sums.top5), recall5: mean(sums.recall5), recall10: mean(sums.recall10), mrr: mean(sums.mrr) };
}

/** Scores a set of searches: the measures overall and per category, and the misses. */
export function scoreSearches(outcomes: readonly SearchOutcome[]): SearchScores {
  const counted = outcomes.filter((o) => o.right.length > 0);
  const categories = [...new Set(counted.map((o) => o.category))];
  const misses: Miss[] = [];
  for (const q of counted) {
    const right = new Set(q.right);
    const rank = bestRank(q.ranked, right);
    if (rank === null || rank > MISS_TOP) {
      misses.push({ ...(q.id === undefined ? {} : { id: q.id }), category: q.category, rank, first: q.ranked.slice(0, MISS_TOP), right: [...right] });
    }
  }
  return {
    overall: measure(counted),
    byCategory: categories.map((category) => ({ category, measures: measure(counted.filter((o) => o.category === category)) })),
    misses,
    skipped: outcomes.length - counted.length,
  };
}
