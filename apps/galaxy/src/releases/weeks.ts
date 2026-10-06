// The weeks of /releases (PRD 262), pure: the rows of public.releases in, the page's weeks out.
//
// - A release is every row sharing a release number: one PRD each above 1, and every PRD of the
//   initial release under 1. Its lines run in PRD order, and it is dated by its latest row.
// - A week starts on Monday, on the Brussels wall clock (Europe/Brussels): a release stamped at 23:30
//   UTC on a Sunday is on Monday in Brussels, so in the next week.
// - Weeks run newest first, and the releases inside a week too; two releases stamped the same moment
//   put the higher number first.
// - The OPEN_WEEKS newest weeks are open; each older one is folded, its counts on its summary.
//
// No Next.js, no Node-only import: the page's server render and the tests load it alike.
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { releaseVersion, type ReleaseRow } from './row.ts';

/** The time zone a release's day and week are read in. */
export const TIME_ZONE = 'Europe/Brussels';

/** How many of the newest weeks the page shows open. */
export const OPEN_WEEKS = 4;

/** A calendar day on the Brussels wall clock. `weekday` counts from Monday, 0, to Sunday, 6. */
export type Day = { year: number; month: number; day: number; weekday: number };

export type Release = {
  release: number;
  /** Always in full: `0.0.<release>`. */
  version: string;
  /** The row's `released_at`, or the latest of them for a release of several PRDs. */
  releasedAt: string;
  /** The day of `releasedAt`, in Brussels. */
  day: Day;
  /** Its rows, in PRD order: one, or every PRD of the initial release. */
  lines: ReleaseRow[];
};

export type Week = {
  /** The Monday it starts on. */
  monday: Day;
  /** Newest first. */
  releases: Release[];
  /** How many PRDs its releases hold. */
  prds: number;
  /** Among the OPEN_WEEKS newest: shown open, not folded. */
  open: boolean;
};

const WALL_CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The day `year-month-day` names, with its weekday. Out-of-range days roll over, as Date.UTC does. */
function calendarDay(year: number, month: number, day: number): Day {
  const date = new Date(Date.UTC(year, month - 1, day));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: (date.getUTCDay() + 6) % 7 };
}

/** The Brussels calendar day of an ISO 8601 instant. */
export function brusselsDay(iso: string): Day {
  const part = (parts: Intl.DateTimeFormatPart[], type: string) => Number(parts.find((p) => p.type === type)?.value);
  const parts = WALL_CLOCK.formatToParts(new Date(Date.parse(iso)));
  return calendarDay(part(parts, 'year'), part(parts, 'month'), part(parts, 'day'));
}

/** The Monday of the week `day` falls in. */
export function mondayOf(day: Day): Day {
  return calendarDay(day.year, day.month, day.day - day.weekday);
}

const dayKey = ({ year, month, day }: Day) => year * 10_000 + month * 100 + day;
const time = (iso: string) => Date.parse(iso);
/** Newest first; the higher release number first when two land the same moment. */
const newestFirst = (a: Release, b: Release) => time(b.releasedAt) - time(a.releasedAt) || b.release - a.release;

/** The releases the rows make, newest first. */
export function releasesOf(rows: readonly ReleaseRow[]): Release[] {
  const byRelease = new Map<number, ReleaseRow[]>();
  for (const row of rows) byRelease.set(row.release, [...(byRelease.get(row.release) ?? []), row]);
  return [...byRelease].map(([release, group]): Release => {
    const lines = [...group].sort((a, b) => a.prd - b.prd);
    const releasedAt = lines.reduce((latest, row) => (time(row.released_at) > time(latest) ? row.released_at : latest), at(lines, 0, `release ${release}'s first line`).released_at);
    return { release, version: releaseVersion(release), releasedAt, day: brusselsDay(releasedAt), lines };
  }).sort(newestFirst);
}

/** The page's weeks, newest first: only weeks that hold a release, the OPEN_WEEKS newest open. */
export function weeksOf(rows: readonly ReleaseRow[]): Week[] {
  const byMonday = new Map<number, Week>();
  for (const release of releasesOf(rows)) {
    const monday = mondayOf(release.day);
    const week = byMonday.get(dayKey(monday)) ?? { monday, releases: [], prds: 0, open: false };
    week.releases.push(release);
    week.prds += release.lines.length;
    byMonday.set(dayKey(monday), week);
  }
  return [...byMonday.values()]
    .sort((a, b) => dayKey(b.monday) - dayKey(a.monday))
    .map((week, i) => ({ ...week, open: i < OPEN_WEEKS }));
}
