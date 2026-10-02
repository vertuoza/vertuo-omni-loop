import { describe, expect, it } from 'vitest';
import { axisTicks, brusselsDay, chartDays, dayName, weekDays, weekTotal, type Merge } from './chart';
import { sure } from '../../arcade/sure';

// The week's days (PRD 328): seven Brussels days, the six before today and today, today last; each
// counts your pull requests merged into main on it. A person reads "today" in their own time, so the
// week alone of the dashboard counts Brussels days, while the season is the UTC month.

/** Saturday 26 September 2026, noon in Brussels (summer time, UTC+2). */
const NOW = new Date('2026-09-26T10:00:00Z');
const merged = (login: string, at: string): Merge => ({ kind: 'pr-merged', login, at });
const counts = (rows: Merge[], now = NOW, login = 'ada-gh') => chartDays(rows, now, login).map((d) => d.count);

describe('brusselsDay', () => {
  it('is the calendar day in Brussels: two hours ahead of UTC in summer, one in winter', () => {
    expect(brusselsDay(new Date('2026-09-20T21:59:59Z'))).toBe('2026-09-20');
    expect(brusselsDay(new Date('2026-09-20T22:00:00Z'))).toBe('2026-09-21');
    expect(brusselsDay(new Date('2026-12-06T22:30:00Z'))).toBe('2026-12-06');
    expect(brusselsDay(new Date('2026-12-06T23:00:00Z'))).toBe('2026-12-07');
  });

  it('reads an instant as a row stores it, with its offset', () => {
    expect(brusselsDay('2026-09-20T22:30:00+00:00')).toBe('2026-09-21');
    expect(brusselsDay('2026-09-21T00:30:00+02:00')).toBe('2026-09-21');
  });
});

describe('weekDays', () => {
  it('is seven Brussels days, the six before today and today, today last', () => {
    expect(weekDays(NOW)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']);
  });

  it('turns to the next day at midnight in Brussels, not in UTC', () => {
    // 22:30 UTC on Saturday is 00:30 on Sunday in Brussels: Sunday is today.
    expect(weekDays(new Date('2026-09-26T22:30:00Z')).at(-1)).toBe('2026-09-27');
    expect(weekDays(new Date('2026-09-26T21:30:00Z')).at(-1)).toBe('2026-09-26');
  });

  it('crosses a month and a year as calendar days', () => {
    expect(weekDays(new Date('2027-01-02T12:00:00Z'))).toEqual(['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('keeps seven distinct days across the night the clocks go back', () => {
    // Summer time ends on Sunday 25 October 2026: that day lasts 25 hours in Brussels.
    const days = weekDays(new Date('2026-10-27T00:30:00Z'));
    expect(days).toEqual(['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });
});

describe('dayName', () => {
  it('names a calendar day\'s weekday, short and long', () => {
    expect(dayName('2026-09-26')).toEqual({ short: 'Sat', long: 'Saturday', date: '26 September' });
    expect(dayName('2026-09-21')).toEqual({ short: 'Mon', long: 'Monday', date: '21 September' });
    expect(dayName('2027-01-03')).toMatchObject({ short: 'Sun', date: '3 January' });
  });
});

describe('chartDays', () => {
  it('returns the seven days with today last, each with its count', () => {
    const days = chartDays([], NOW, 'ada-gh');
    expect(days.map((d) => d.date)).toEqual(weekDays(NOW));
    expect(days.at(-1)?.date).toBe('2026-09-26');
  });

  it('counts each merge on its Brussels day', () => {
    expect(counts([
      merged('ada-gh', '2026-09-22T09:30:00Z'),
      merged('ada-gh', '2026-09-24T14:00:00Z'),
      merged('ada-gh', '2026-09-24T16:10:00Z'),
    ])).toEqual([0, 0, 1, 0, 2, 0, 0]);
  });

  it('counts a merge at 22:30 UTC on a Sunday in summer on Monday', () => {
    expect(counts([merged('ada-gh', '2026-09-20T22:30:00Z')])).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });

  it('counts a merge at 22:30 UTC on a Sunday in winter on Sunday, and at 23:30 on Monday', () => {
    const now = new Date('2026-12-09T12:00:00Z'); // Wednesday
    const rows = [merged('ada-gh', '2026-12-06T22:30:00Z'), merged('ada-gh', '2026-12-06T23:30:00Z')];
    const days = chartDays(rows, now, 'ada-gh');
    expect(days.find((d) => d.date === '2026-12-06')?.count).toBe(1);
    expect(days.find((d) => d.date === '2026-12-07')?.count).toBe(1);
  });

  it('shows a day with none as 0: an empty week is seven zeros', () => {
    expect(counts([])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('counts today\'s merges, up to the latest', () => {
    expect(counts([merged('ada-gh', '2026-09-26T09:59:00Z'), merged('ada-gh', '2026-09-25T22:00:00Z')])).toEqual([0, 0, 0, 0, 0, 0, 2]);
  });

  it('never counts another person\'s merges', () => {
    expect(counts([merged('both-gh', '2026-09-24T14:00:00Z'), merged('ada-gh-2', '2026-09-24T14:00:00Z')])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('never counts a merge outside the week: before its first day, or after today', () => {
    expect(counts([
      merged('ada-gh', '2026-09-19T21:59:00Z'), // Saturday 19, 23:59 in Brussels
      merged('ada-gh', '2026-09-19T22:00:00Z'), // Sunday 20, 00:00 in Brussels: the first day
      merged('ada-gh', '2026-09-26T22:00:00Z'), // Sunday 27 in Brussels: tomorrow
      merged('ada-gh', '2026-08-31T22:30:00Z'),
    ])).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it('counts only merges: a PRD opened is not a pull request merged', () => {
    expect(counts([{ kind: 'prd-opened', login: 'ada-gh', at: '2026-09-24T14:00:00Z' }])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('matches logins ignoring case, on either side', () => {
    const rows = [merged('Ada-GH', '2026-09-22T09:30:00Z'), merged('ada-gh', '2026-09-23T09:30:00Z')];
    expect(counts(rows, NOW, 'ada-gh')).toEqual([0, 0, 1, 1, 0, 0, 0]);
    expect(counts(rows, NOW, 'ADA-gh')).toEqual([0, 0, 1, 1, 0, 0, 0]);
  });

  it('skips a row whose instant cannot be read, rather than guess its day', () => {
    expect(counts([merged('ada-gh', 'not a date'), merged('ada-gh', '2026-09-22T09:30:00Z')])).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });
});

describe('weekTotal', () => {
  it('is the sum of the seven days', () => {
    expect(weekTotal(chartDays([merged('ada-gh', '2026-09-22T09:30:00Z'), merged('ada-gh', '2026-09-24T14:00:00Z')], NOW, 'ada-gh'))).toBe(2);
    expect(weekTotal(chartDays([], NOW, 'ada-gh'))).toBe(0);
  });
});

describe('axisTicks', () => {
  it('marks every whole number from 0 to the highest bar, while there are few', () => {
    expect(axisTicks(3)).toEqual([0, 1, 2, 3]);
    expect(axisTicks(5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('runs to at least 1: an empty week still has an axis', () => {
    expect(axisTicks(0)).toEqual([0, 1]);
    expect(axisTicks(1)).toEqual([0, 1]);
  });

  it('steps by a round whole number past five, and always marks the highest bar', () => {
    expect(axisTicks(6)).toEqual([0, 2, 4, 6]);
    expect(axisTicks(8)).toEqual([0, 2, 4, 6, 8]);
    expect(axisTicks(9)).toEqual([0, 2, 4, 6, 9]);
    expect(axisTicks(12)).toEqual([0, 5, 12]);
    expect(axisTicks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(axisTicks(37)).toEqual([0, 10, 20, 30, 37]);
  });

  it('marks only whole numbers, never more than six, and never two a step apart at the top', () => {
    for (let max = 0; max <= 250; max += 1) {
      const ticks = axisTicks(max);
      expect(ticks.every(Number.isInteger), `${max}`).toBe(true);
      expect(ticks.length, `${max}`).toBeLessThanOrEqual(6);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(Math.max(1, max));
      const step = sure(ticks[1], 'ticks[1]') - sure(ticks[0], 'ticks[0]');
      if (ticks.length > 2) expect(sure(ticks.at(-1), 'ticks.at(-1)') - sure(ticks.at(-2), 'ticks.at(-2)'), `${max}`).toBeGreaterThan(step / 2);
    }
  });
});
