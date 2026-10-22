import { at } from 'omni-loop/kit/lib/narrow.ts';

/** The median of some numbers: the middle one, the mean of the two middle ones, or null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? at(sorted, mid, 'the middle value') : (at(sorted, mid - 1, 'the value below the middle') + at(sorted, mid, 'the middle value')) / 2;
}
