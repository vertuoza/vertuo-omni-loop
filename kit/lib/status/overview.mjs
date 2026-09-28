// The repository's overview, from the facts `facts.mjs` read: which stage each PRD is in, the
// counts, and the bar's numbers. Pure: no git, no clock, no config.
//
// Each PRD is counted once, in the first stage that holds it: shipped (its folder is in the base's
// shipped folder), then inbox (its folder is in the base's inbox folder).

/** The bar's width, in cells. */
export const BAR_CELLS = 30;

/** Each PRD number once, newest first, leaving out the numbers in `taken`. */
function stage(folders, taken = new Set()) {
  const seen = new Set(taken);
  const out = [];
  for (const folder of [...folders].sort((a, b) => b.prd - a.prd)) {
    if (seen.has(folder.prd)) continue;
    seen.add(folder.prd);
    out.push({ prd: folder.prd, topic: folder.topic });
  }
  return out;
}

/** Delivered against the total, the percentage and the filled cells both rounded down, so the bar
 * never reads 100% while anything is in progress. No PRD at all has no percentage. */
function barFor(delivered, total) {
  if (total === 0) return { delivered, total, percent: null, filled: 0 };
  return {
    delivered,
    total,
    percent: Math.floor((delivered * 100) / total),
    filled: Math.floor((delivered * BAR_CELLS) / total),
  };
}

/**
 * @param {{ slug: string | null, base: string, fetchedAt: number | null,
 *   shipped: { prd: number, topic: string }[], inbox: { prd: number, topic: string }[] }} facts
 */
export function overviewFor(facts) {
  const shipped = stage(facts.shipped);
  const inbox = stage(facts.inbox, new Set(shipped.map(({ prd }) => prd)));
  return {
    slug: facts.slug,
    base: facts.base,
    fetchedAt: facts.fetchedAt,
    stages: { shipped, inbox },
    counts: { shipped: shipped.length, inbox: inbox.length },
    bar: barFor(shipped.length, shipped.length + inbox.length),
    inProgress: { total: inbox.length, inbox: inbox.length },
  };
}
