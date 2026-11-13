import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERIOD, concernOf, dailyOf, inPeriod, latestOf, lookFirstOf, percent, periodOf, statsOf, topHitOf, type SearchRow,
} from './search-stats';

// The Search section's numbers from fixture rows (PRD omni-loop-6 s3).

const NOW = Date.parse('2026-11-13T12:00:00Z');
const ago = (days: number, hours = 0) => new Date(NOW - days * 86_400_000 - hours * 3_600_000).toISOString();
let n = 0;
const row = (over: Partial<SearchRow> = {}): SearchRow => ({
  id: `r${++n}`, query: 'how do I invoice', mode: 'meaning', total: 3, hitIds: ['a', 'b', 'c'], openedRank: null, askedAt: ago(1), ...over,
});

describe('the period', () => {
  it('is 7, 30 or 90 days from the address, 30 for anything else', () => {
    expect(periodOf({ days: '7' })).toBe(7);
    expect(periodOf({ days: ['90', '7'] })).toBe(90);
    expect(periodOf({ days: '12' })).toBe(DEFAULT_PERIOD);
    expect(periodOf({})).toBe(30);
  });

  it('keeps the rows asked within the days counted back from now, and drops an unreadable or future date', () => {
    const rows = [row({ askedAt: ago(0, 1) }), row({ askedAt: ago(6) }), row({ askedAt: ago(8) }), row({ askedAt: ago(40) }), row({ askedAt: 'never' }), row({ askedAt: ago(-1) })];
    expect(inPeriod(rows, 7, NOW)).toHaveLength(2);
    expect(inPeriod(rows, 30, NOW)).toHaveLength(3);
    expect(inPeriod(rows, 90, NOW)).toHaveLength(4);
  });
});

describe('the numbers', () => {
  const rows = [
    row({ openedRank: 1 }),
    row({ openedRank: 3 }),
    row({ openedRank: 5 }),
    row({ openedRank: 6 }),
    row({ total: 0, hitIds: [] }),
    row({ mode: 'words' }),
    row({ mode: 'words', total: 0, hitIds: [] }),
    row(),
  ];

  it('count the searches, the zero-hit rate and the words-fallback rate over every search', () => {
    const stats = statsOf(rows);
    expect(stats.searches).toBe(8);
    expect(stats.zeroHit).toBe(2 / 8);
    expect(stats.words).toBe(2 / 8);
  });

  it('give opened@1 and opened@5 over the searches an entry was opened from', () => {
    const stats = statsOf(rows);
    expect(stats.opened).toBe(4);
    expect(stats.openedAt1).toBe(1 / 4);
    expect(stats.openedAt5).toBe(3 / 4);
  });

  it('give no rate where there is nothing to divide by', () => {
    expect(statsOf([])).toEqual({ searches: 0, zeroHit: null, words: null, openedAt1: null, openedAt5: null, opened: 0 });
    expect(statsOf([row()]).openedAt1).toBeNull();
  });

  it('read as whole percents, a dash for none', () => {
    expect(percent(1 / 3)).toBe('33%');
    expect(percent(0)).toBe('0%');
    expect(percent(null)).toBe('—');
  });
});

describe('the days', () => {
  it('are one per day of the period, the oldest first, today last, each with its searches and rates', () => {
    const rows = [row({ askedAt: ago(0, 1) }), row({ askedAt: ago(0, 2), total: 0, hitIds: [] }), row({ askedAt: ago(2), mode: 'words' }), row({ askedAt: ago(9) })];
    const days = dailyOf(rows, 7, NOW);
    expect(days.map((d) => d.day)).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    expect(days.map((d) => d.searches)).toEqual([0, 0, 0, 0, 1, 0, 2]);
    expect(days[6]).toEqual({ day: '2026-11-13', searches: 2, zeroHit: 0.5, words: 0 });
    expect(days[4]).toEqual({ day: '2026-11-11', searches: 1, zeroHit: 0, words: 1 });
    expect(days[0]?.zeroHit).toBeNull();
  });
});

describe('the questions', () => {
  const a = row({ query: 'a', askedAt: ago(5) });
  const b = row({ query: 'b', askedAt: ago(1), mode: 'words' });
  const c = row({ query: 'c', askedAt: ago(3), total: 0, hitIds: [] });
  const d = row({ query: 'd', askedAt: ago(2), total: 0, hitIds: [], mode: 'words' });
  const e = row({ query: 'e', askedAt: ago(0, 2) });

  it('come newest first, at most as many as asked', () => {
    expect(latestOf([a, b, c, d, e]).map((r) => r.query)).toEqual(['e', 'b', 'd', 'c', 'a']);
    expect(latestOf([a, b, c, d, e], 2).map((r) => r.query)).toEqual(['e', 'b']);
  });

  it('to look at first are the zero-hit ones, then the ones that fell back, each newest first', () => {
    expect(lookFirstOf([a, b, c, d, e]).map((r) => r.query)).toEqual(['d', 'c', 'b']);
    expect(lookFirstOf([a, b, c, d, e], 2).map((r) => r.query)).toEqual(['d', 'c']);
    expect(lookFirstOf([a, e])).toEqual([]);
  });

  it('say why one is to look at, and show its top hit', () => {
    expect([a, b, c, d].map(concernOf)).toEqual([null, 'fell back', 'no hit', 'no hit']);
    expect(topHitOf(a)).toBe('a');
    expect(topHitOf(c)).toBe('—');
  });
});
