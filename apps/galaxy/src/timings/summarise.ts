// The numbers the timings script prints (PRD 657): over one page's loads, the median and p75 of the
// time to first byte and to the full document, in milliseconds. Pure, so it is tested on a fixed
// sample. It runs on plain Node (scripts/timings.ts), so its imports name their extension.

/** One load of one page: when the first byte arrived, and when the whole document had. */
export type Sample = { ttfb: number; total: number };

export type Spread = { median: number; p75: number };

export type Summary = { runs: number; ttfb: Spread; total: Spread };

/** The `q` quantile of `values` (0 to 1), interpolated between the two nearest ranks. */
export function percentile(values: readonly number[], q: number): number {
  if (!values.length) throw new Error('percentile: no samples');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * q;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (rank - low);
}

const spread = (values: number[]): Spread => ({ median: percentile(values, 0.5), p75: percentile(values, 0.75) });

/** The median and p75 of both timings over `samples`. */
export function summarise(samples: readonly Sample[]): Summary {
  return {
    runs: samples.length,
    ttfb: spread(samples.map((s) => s.ttfb)),
    total: spread(samples.map((s) => s.total)),
  };
}
