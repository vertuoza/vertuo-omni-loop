import { describe, expect, it } from 'vitest';
import { BAR_CELLS, overviewFor } from './overview.mjs';

/** Facts as `readFacts` returns them, with a PRD per number: `n` becomes `{ prd: n, topic: 't<n>' }`. */
function facts({ shipped = [], inbox = [], ...more } = {}) {
  const folder = (prd) => ({ prd, topic: `t${prd}` });
  return { slug: 'acme/widgets', base: 'origin/main', fetchedAt: null, shipped: shipped.map(folder), inbox: inbox.map(folder), ...more };
}

describe('overviewFor — the shipped and inbox stages', () => {
  it('counts the shipped and the inbox folders of the base', () => {
    const overview = overviewFor(facts({ shipped: [1, 2, 3], inbox: [4, 5] }));
    expect(overview.counts).toEqual({ shipped: 3, inbox: 2 });
    expect(overview.inProgress).toEqual({ total: 2, inbox: 2 });
  });

  it('lists each stage newest first', () => {
    const overview = overviewFor(facts({ shipped: [1, 3, 2], inbox: [4, 6, 5] }));
    expect(overview.stages.shipped.map(({ prd }) => prd)).toEqual([3, 2, 1]);
    expect(overview.stages.inbox.map(({ prd }) => prd)).toEqual([6, 5, 4]);
  });

  it('counts a PRD once, shipped first, when its number sits in both folders', () => {
    const overview = overviewFor(facts({ shipped: [1, 2], inbox: [2, 3] }));
    expect(overview.counts).toEqual({ shipped: 2, inbox: 1 });
    expect(overview.stages.inbox.map(({ prd }) => prd)).toEqual([3]);
  });

  it('counts two folders of one PRD number once', () => {
    const overview = overviewFor({ ...facts(), inbox: [{ prd: 7, topic: 'a' }, { prd: 7, topic: 'b' }] });
    expect(overview.counts.inbox).toBe(1);
  });

  it('carries the header facts through', () => {
    const overview = overviewFor(facts({ slug: null, base: 'main', fetchedAt: 1000 }));
    expect(overview).toMatchObject({ slug: null, base: 'main', fetchedAt: 1000 });
  });
});

describe('overviewFor — the bar', () => {
  it('is 30 cells', () => {
    expect(BAR_CELLS).toBe(30);
  });

  it('is delivered against shipped + inbox', () => {
    expect(overviewFor(facts({ shipped: [1, 2, 3], inbox: [4, 5] })).bar).toEqual({ delivered: 3, total: 5, percent: 60, filled: 18 });
  });

  it('rounds the percentage and the filled cells down', () => {
    const shipped = Array.from({ length: 29 }, (_, index) => index + 1);
    expect(overviewFor(facts({ shipped, inbox: [30] })).bar).toEqual({ delivered: 29, total: 30, percent: 96, filled: 29 });
    expect(overviewFor(facts({ shipped: [1, 2], inbox: [3] })).bar).toEqual({ delivered: 2, total: 3, percent: 66, filled: 20 });
    expect(overviewFor(facts({ shipped: [1], inbox: [2, 3, 4, 5, 6, 7] })).bar).toEqual({ delivered: 1, total: 7, percent: 14, filled: 4 });
  });

  it('never reads 100% while anything is in progress', () => {
    const shipped = Array.from({ length: 999 }, (_, index) => index + 1);
    const { bar } = overviewFor(facts({ shipped, inbox: [1000] }));
    expect(bar.percent).toBe(99);
    expect(bar.filled).toBe(29);
  });

  it('is full at 100% when everything shipped', () => {
    expect(overviewFor(facts({ shipped: [1, 2] })).bar).toEqual({ delivered: 2, total: 2, percent: 100, filled: 30 });
  });

  it('is empty at 0% when nothing shipped', () => {
    expect(overviewFor(facts({ inbox: [1] })).bar).toEqual({ delivered: 0, total: 1, percent: 0, filled: 0 });
  });

  it('has a zero total, and no percentage, with no PRD at all', () => {
    const overview = overviewFor(facts());
    expect(overview.counts).toEqual({ shipped: 0, inbox: 0 });
    expect(overview.bar).toEqual({ delivered: 0, total: 0, percent: null, filled: 0 });
    expect(overview.inProgress).toEqual({ total: 0, inbox: 0 });
  });
});
