import type { Query } from '../../nav/query';
import { NONE } from '../knowledge-sections';

// The Search section's numbers (PRD omni-loop-6 s3), pure: from the rows of the MCP search log, for a period of
// 7, 30 or 90 days, the searches, the zero-hit rate, the words-fallback rate, opened@1 and opened@5, a day by
// day series for the chart, the latest questions and the ones to look at first. Nothing here reads the log.

/** One search the product's MCP answered, as the section reads it. */
export interface SearchRow {
  id: string;
  query: string | null;
  mode: 'meaning' | 'words' | null;
  total: number;
  hitIds: readonly string[];
  /** The rank (from 1) of the entry a later `get_knowledge` opened, once one did. */
  openedRank: number | null;
  askedAt: string;
}

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = 30;

/** `?days=7|30|90` asks for a period; anything else, the default. */
export const periodOf = (query: Query): Period => {
  const raw = Array.isArray(query.days) ? query.days[0] : query.days;
  return PERIODS.find((p) => String(p) === raw) ?? DEFAULT_PERIOD;
};

export const NO_SEARCH = 'No search yet. Questions appear here once an agent asks this product’s MCP server.';
export const noSearchIn = (days: Period): string => `No search in the last ${days} days.`;

const DAY = 86_400_000;

const timeOf = (at: string): number | null => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? null : t;
};

/** The day (UTC) of a time, `YYYY-MM-DD`. */
const dayKey = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** The rows asked within the last `days` days, counted back from `now`; a row with no readable date is left out. */
export function inPeriod(rows: readonly SearchRow[], days: Period, now: number): SearchRow[] {
  const from = now - days * DAY;
  return rows.filter((row) => {
    const t = timeOf(row.askedAt);
    return t !== null && t > from && t <= now;
  });
}

/** `part` over `whole`, as a fraction of 1; null when there is nothing to divide by. */
const rate = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

export interface SearchStats {
  searches: number;
  zeroHit: number | null;
  words: number | null;
  /** Of the searches an entry was opened from, the share opened at rank 1, and within the top 5. */
  openedAt1: number | null;
  openedAt5: number | null;
  /** How many searches had an entry opened: the base of opened@1 and opened@5. */
  opened: number;
}

const zero = (row: SearchRow): boolean => row.total === 0;
const fellBack = (row: SearchRow): boolean => row.mode === 'words';

/** The numbers of a set of rows. */
export function statsOf(rows: readonly SearchRow[]): SearchStats {
  const opened = rows.filter((row) => row.openedRank !== null);
  return {
    searches: rows.length,
    zeroHit: rate(rows.filter(zero).length, rows.length),
    words: rate(rows.filter(fellBack).length, rows.length),
    openedAt1: rate(opened.filter((row) => row.openedRank === 1).length, opened.length),
    openedAt5: rate(opened.filter((row) => (row.openedRank ?? Infinity) <= 5).length, opened.length),
    opened: opened.length,
  };
}

/** A rate as a whole percent, a dash for none. */
export const percent = (value: number | null): string => (value === null ? NONE : `${Math.round(value * 100)}%`);

export interface Day {
  day: string;
  searches: number;
  zeroHit: number | null;
  words: number | null;
}

/** One entry per day of the period, the oldest first, today last; a day with no search has no rate. */
export function dailyOf(rows: readonly SearchRow[], days: Period, now: number): Day[] {
  const byDay = new Map<string, SearchRow[]>();
  for (const row of inPeriod(rows, days, now)) {
    const t = timeOf(row.askedAt);
    if (t === null) continue;
    const key = dayKey(t);
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(now - (days - 1 - i) * DAY);
    const stats = statsOf(byDay.get(day) ?? []);
    return { day, searches: stats.searches, zeroHit: stats.zeroHit, words: stats.words };
  });
}

const byNewest = (a: SearchRow, b: SearchRow): number => (timeOf(b.askedAt) ?? 0) - (timeOf(a.askedAt) ?? 0);

/** The latest questions, newest first. */
export const latestOf = (rows: readonly SearchRow[], most = 20): SearchRow[] => [...rows].sort(byNewest).slice(0, most);

/** Why a question is one to look at: it found nothing, or meaning search fell back to words. */
export type Concern = 'no hit' | 'fell back';
export const concernOf = (row: SearchRow): Concern | null => (zero(row) ? 'no hit' : fellBack(row) ? 'fell back' : null);

/** The zero-hit questions first, then the ones that fell back, each newest first. */
export function lookFirstOf(rows: readonly SearchRow[], most = 10): SearchRow[] {
  const sorted = [...rows].sort(byNewest);
  return [...sorted.filter(zero), ...sorted.filter((row) => !zero(row) && fellBack(row))].slice(0, most);
}

/** The top hit of a search, a dash for none. */
export const topHitOf = (row: SearchRow): string => row.hitIds[0] ?? NONE;
