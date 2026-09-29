import { describe, expect, it } from 'vitest';
import { brusselsDay, brusselsMidnight, periodOf, periodWindow, PERIODS } from './period';

// The board's period (PRD 572): 7 days (the default), 30 days or the season, each a run of Brussels
// days ending today, today last. The season is the UTC month, as the game scores it: its days run from
// the month's first day to today.

/** Saturday 26 September 2026, noon in Brussels (summer time, UTC+2). */
const NOW = new Date('2026-09-26T10:00:00Z');

describe('periodOf', () => {
  it('reads 7d, 30d and season, and anything else as 7 days', () => {
    expect(periodOf('7d')).toBe('7d');
    expect(periodOf('30d')).toBe('30d');
    expect(periodOf('season')).toBe('season');
    for (const other of [undefined, null, '', '14d', 'SEASON', ['30d']]) expect(periodOf(other as never)).toBe('7d');
  });

  it('lists the three in the switch\'s order, each with its label', () => {
    expect(PERIODS.map((p) => [p.id, p.label])).toEqual([['7d', '7 days'], ['30d', '30 days'], ['season', 'Season']]);
  });
});

describe('brusselsDay and brusselsMidnight', () => {
  it('is the calendar day in Brussels: two hours ahead of UTC in summer, one in winter', () => {
    expect(brusselsDay(new Date('2026-09-20T21:59:59Z'))).toBe('2026-09-20');
    expect(brusselsDay('2026-09-20T22:00:00Z')).toBe('2026-09-21');
    expect(brusselsDay('2026-12-06T23:00:00Z')).toBe('2026-12-07');
    expect(brusselsDay('not a date')).toBeNull();
  });

  it('finds the first instant of a Brussels day, on either side of a clock change', () => {
    expect(brusselsMidnight('2026-09-21').toISOString()).toBe('2026-09-20T22:00:00.000Z');
    expect(brusselsMidnight('2026-12-07').toISOString()).toBe('2026-12-06T23:00:00.000Z');
    // Sunday 25 October 2026: the clocks go back at 03:00, and midnight is still summer time.
    expect(brusselsMidnight('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(brusselsMidnight('2026-10-26').toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });
});

describe('periodWindow', () => {
  it('7 days: the six days before today and today, today last', () => {
    const w = periodWindow('7d', NOW);
    expect(w.days).toEqual(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']);
    expect(w.from.toISOString()).toBe('2026-09-19T22:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-09-26T22:00:00.000Z');
  });

  it('30 days: thirty days ending today', () => {
    const w = periodWindow('30d', NOW);
    expect(w.days).toHaveLength(30);
    expect(w.days[0]).toBe('2026-08-28');
    expect(w.days.at(-1)).toBe('2026-09-26');
  });

  it('season: the UTC month\'s days up to today', () => {
    const w = periodWindow('season', NOW);
    expect(w.days).toHaveLength(26);
    expect(w.days[0]).toBe('2026-09-01');
    expect(w.days.at(-1)).toBe('2026-09-26');
  });

  it('season, on the month\'s first night in Brussels while UTC is still in the last month: that month, whole', () => {
    // 22:30 UTC on 30 September is 00:30 on 1 October in Brussels, and still September's season.
    const w = periodWindow('season', new Date('2026-09-30T22:30:00Z'));
    expect(w.days[0]).toBe('2026-09-01');
    expect(w.days.at(-1)).toBe('2026-09-30');
    expect(w.to.toISOString()).toBe('2026-09-30T22:00:00.000Z');
  });

  it('never counts a day twice nor drops one across a clock change', () => {
    const w = periodWindow('7d', new Date('2026-10-28T10:00:00Z'));
    expect(w.days).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
  });
});
