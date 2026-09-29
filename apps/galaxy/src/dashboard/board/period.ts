import { seasonBounds } from '../season';

// The board's period (PRD 572): the switch at the top of every dashboard page, kept in the URL as
// `?period=7d|30d|season`, 7 days when absent or unknown. Every period is a run of Brussels days
// ending today, today last: a person reads "today" in their own time, and the charts draw one column
// a day. The season is the UTC month the game scores (../season.ts): its days run from the month's
// first day up to today, and never past the month's last. A day is a calendar date (`2026-09-26`),
// never an instant, so a night the clocks change neither drops a day nor counts one twice; the
// window's instants, which the reads filter on, are the first day's midnight and the midnight after
// the last day, in Brussels.

export type Period = '7d' | '30d' | 'season';

/** The switch's links, in order. */
export const PERIODS: readonly { id: Period; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'season', label: 'Season' },
];

/** The period a query value names: 7 days for anything but `30d` and `season`. */
export function periodOf(value: string | string[] | null | undefined): Period {
  return value === '30d' || value === 'season' ? value : '7d';
}

/** The time zone the board's days are read in. */
export const BOARD_ZONE = 'Europe/Brussels';

const CALENDAR = new Intl.DateTimeFormat('en-GB', { timeZone: BOARD_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar day an instant falls on in Brussels, `2026-09-26`; null when it cannot be read. */
export function brusselsDay(at: Date | string | number): string | null {
  const t = typeof at === 'string' ? Date.parse(at) : typeof at === 'number' ? at : at.getTime();
  if (Number.isNaN(t)) return null;
  const part = Object.fromEntries(CALENDAR.formatToParts(t).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

const HOUR = 3_600_000;
const utcDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const shift = (date: string, days: number) => new Date(utcDate(date) + days * 24 * HOUR).toISOString().slice(0, 10);

/** The first instant of a Brussels day: its UTC midnight less one or two hours, whichever begins it. */
export function brusselsMidnight(date: string): Date {
  const t = utcDate(date);
  for (const hours of [2, 1]) {
    const at = t - hours * HOUR;
    if (brusselsDay(at) === date && brusselsDay(at - 1) !== date) return new Date(at);
  }
  return new Date(t - HOUR);
}

/** A period's days, today last, and the instants that bound them: [from, to). */
export interface PeriodWindow {
  period: Period;
  days: string[];
  from: Date;
  to: Date;
}

function daysBetween(first: string, last: string): string[] {
  const days: string[] = [];
  for (let d = first; d <= last; d = shift(d, 1)) days.push(d);
  return days;
}

export function periodWindow(period: Period, now: Date): PeriodWindow {
  const today = brusselsDay(now)!;
  let days: string[];
  if (period === 'season') {
    const season = seasonBounds(now);
    const first = season.from.toISOString().slice(0, 10);
    const last = shift(season.to.toISOString().slice(0, 10), -1);
    days = daysBetween(first, today < last ? today : last);
  } else {
    const length = period === '30d' ? 30 : 7;
    days = daysBetween(shift(today, 1 - length), today);
  }
  return { period, days, from: brusselsMidnight(days[0]), to: brusselsMidnight(shift(days.at(-1)!, 1)) };
}
