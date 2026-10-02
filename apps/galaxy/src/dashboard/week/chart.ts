import { at, dateParts, defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The week of merges' days (PRD 328): seven days in Brussels, the six before today and today, today
// last, each counting your pull requests merged into their repository's default branch on it. A
// person reads "today" in their own time, so the week alone of the dashboard counts Brussels days,
// while the season is the UTC month (../season.ts). A day is a calendar date (`2026-09-26`), never
// an instant: the days before today are counted back on the calendar, so a night the clocks change
// neither drops a day nor counts one twice.

/** A row of `contributions` as the week reads it: its kind, its author's login, when it happened. */
export interface Merge {
  kind: string;
  login: string;
  /** For a merged pull request, when it merged: an ISO instant, as the row stores it. */
  at: string;
}

/** One day of the week: its calendar date in Brussels, and how many of your pull requests merged. */
export interface ChartDay {
  /** `2026-09-26`. */
  date: string;
  count: number;
}

/** The time zone the week's days are read in. */
export const WEEK_ZONE = 'Europe/Brussels';

const CALENDAR = new Intl.DateTimeFormat('en-GB', { timeZone: WEEK_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar day an instant falls on in Brussels, `2026-09-26`; null when it cannot be read. */
export function brusselsDay(at: Date | string): string | null {
  const t = typeof at === 'string' ? Date.parse(at) : at.getTime();
  if (Number.isNaN(t)) return null;
  const part = Object.fromEntries(CALENDAR.formatToParts(t).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

/** The seven days of the week that ends today in Brussels, the first six before it, today last. */
export function weekDays(now: Date): string[] {
  const [year, month, day] = dateParts(defined(brusselsDay(now), 'today in Brussels'));
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(year, month - 1, day - 6 + i)).toISOString().slice(0, 10));
}

/**
 * The week's seven days, each counting `login`'s merged pull requests (kind `pr-merged`) whose `at`
 * falls on it in Brussels. Logins match ignoring case; anyone else's rows, any other kind and any
 * row outside the week count for nothing, and a row whose instant cannot be read is skipped.
 */
export function chartDays(rows: readonly Merge[], now: Date, login: string): ChartDay[] {
  const days = weekDays(now);
  const counts = new Map(days.map((date) => [date, 0]));
  const you = login.toLowerCase();
  for (const row of rows) {
    if (row.kind !== 'pr-merged' || row.login.toLowerCase() !== you) continue;
    const date = brusselsDay(row.at);
    const count = date === null ? undefined : counts.get(date);
    if (date !== null && count !== undefined) counts.set(date, count + 1);
  }
  return days.map((date) => ({ date, count: defined(counts.get(date), `the merges of ${date}`) }));
}

/** The week's sum, which the chart shows at its top right. */
export const weekTotal = (days: readonly ChartDay[]) => days.reduce((sum, day) => sum + day.count, 0);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A calendar day, as the chart names it: its weekday under its bar (`Sat`), and in full with its
 * date in the text alternative (`Saturday`, `26 September`). */
export function dayName(date: string): { short: string; long: string; date: string } {
  const [year, month, day] = dateParts(date);
  const long = at(WEEKDAYS, new Date(Date.UTC(year, month - 1, day)).getUTCDay(), 'the weekday');
  return { short: long.slice(0, 3), long, date: `${day} ${MONTHS[month - 1]}` };
}

/** The round whole steps the axis may take: 1, 2, 5, 10, 20, 50… */
function step(top: number): number {
  for (let scale = 1; ; scale *= 10) {
    for (const s of [1, 2, 5]) if (top / (s * scale) <= 5) return s * scale;
  }
}

/**
 * The y-axis's marks: whole numbers only, from 0 to the week's highest bar (at least 1), so the
 * highest bar reaches the top mark. Every whole number while there are five or fewer; past that, a
 * round step (2, 5, 10…) and the highest bar, dropping the step's last mark when it would sit within
 * half a step of the top.
 */
export function axisTicks(max: number): number[] {
  const top = Math.max(1, Math.ceil(max));
  const by = step(top);
  const ticks: number[] = [];
  for (let mark = 0; mark < top; mark += by) if (mark === 0 || top - mark > by / 2) ticks.push(mark);
  return [...ticks, top];
}
