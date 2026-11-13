import type { Query } from '../../../nav/query';
import type { DomainChoice } from '../../knowledge-sections';
import { inPeriod, statsOf, type Period, type SearchRow } from '../search-stats';

// The Categories view's numbers (PRD omni-loop-7 s4), pure: from the rows of the MCP search log, for a period of
// 7, 30 or 90 days, each category (a domain of the product, `other`, or none yet) with its searches, zero-hit
// rate, words-fallback rate and opened@5, and inside it its groups of near-identical questions by count, each with
// its first question and its worst opened rank. Nothing here reads the log.

/** A search as the Categories view reads it: the Search section's row, with its category and its group. */
export interface CategorizedRow extends SearchRow {
  category: string | null;
  groupId: string | null;
}

/** A group's head: its id and its first question. */
export interface GroupHead {
  id: string;
  question: string;
}

export const NOT_CATEGORIZED = 'Not categorized';
/** The `?category=` value of the searches with no category yet: no domain key is a lone dash. */
export const UNCATEGORIZED = '-';

export interface GroupSummary {
  /** The group's id, or `search:<id>` for a search not grouped yet, shown as a group of its own. */
  key: string;
  question: string;
  count: number;
  /** The highest rank an entry was opened at among its searches; null when none was opened. */
  worstOpened: number | null;
  /** Its searches, newest first. */
  rows: CategorizedRow[];
}

export interface CategorySummary {
  category: string | null;
  searches: number;
  zeroHit: number | null;
  words: number | null;
  openedAt5: number | null;
  opened: number;
  /** Its groups, the most asked first. */
  groups: GroupSummary[];
}

const timeOf = (row: SearchRow): number => {
  const t = Date.parse(row.askedAt);
  return Number.isNaN(t) ? 0 : t;
};
const byNewest = (a: SearchRow, b: SearchRow): number => timeOf(b) - timeOf(a);

const groupKey = (row: CategorizedRow): string => row.groupId ?? `search:${row.id}`;

function groupOf(key: string, rows: CategorizedRow[], heads: ReadonlyMap<string, string>): GroupSummary {
  const sorted = [...rows].sort(byNewest);
  const oldest = sorted[sorted.length - 1];
  const opened = sorted.flatMap((r) => (r.openedRank === null ? [] : [r.openedRank]));
  return {
    key,
    question: heads.get(key) ?? oldest?.query ?? '',
    count: sorted.length,
    worstOpened: opened.length === 0 ? null : Math.max(...opened),
    rows: sorted,
  };
}

const byCount = (a: GroupSummary, b: GroupSummary): number => b.count - a.count || a.question.localeCompare(b.question);

function summaryOf(category: string | null, rows: CategorizedRow[], heads: ReadonlyMap<string, string>): CategorySummary {
  const stats = statsOf(rows);
  const byGroup = new Map<string, CategorizedRow[]>();
  for (const row of rows) byGroup.set(groupKey(row), [...(byGroup.get(groupKey(row)) ?? []), row]);
  return {
    category, searches: stats.searches, zeroHit: stats.zeroHit, words: stats.words, openedAt5: stats.openedAt5, opened: stats.opened,
    groups: [...byGroup].map(([key, list]) => groupOf(key, list, heads)).sort(byCount),
  };
}

/** Ties keep a named category before Not categorized, then go by key. */
const bySearches = (a: CategorySummary, b: CategorySummary): number =>
  b.searches - a.searches || Number(a.category === null) - Number(b.category === null) || (a.category ?? '').localeCompare(b.category ?? '');

/** The categories of the rows asked within the last `days` days, the most searched first. */
export function categoriesOf(rows: readonly CategorizedRow[], heads: readonly GroupHead[], days: Period, now: number): CategorySummary[] {
  const questions = new Map(heads.map((h) => [h.id, h.question]));
  const byCategory = new Map<string | null, CategorizedRow[]>();
  const shown = new Set<SearchRow>(inPeriod(rows, days, now));
  for (const row of rows.filter((r) => shown.has(r))) byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);
  return [...byCategory].map(([category, list]) => summaryOf(category, list, questions)).sort(bySearches);
}

/** Whether any search of the period holds a category yet. */
export const hasCategory = (categories: readonly CategorySummary[]): boolean => categories.some((c) => c.category !== null);

/** A category's name: its domain's, Other for `other`, Not categorized for none, its key for a domain no longer listed. */
export function categoryLabel(category: string | null, domains: readonly DomainChoice[]): string {
  if (category === null) return NOT_CATEGORIZED;
  if (category === 'other') return 'Other';
  return domains.find((d) => d.key === category)?.name ?? category;
}

/** The `?category=` value of a category. */
export const categoryParam = (category: string | null): string => category ?? UNCATEGORIZED;

/** The category `?category=` opens, else the most searched one; null when there is none. */
export function openCategoryOf(categories: readonly CategorySummary[], query: Query): CategorySummary | null {
  const raw = Array.isArray(query.category) ? query.category[0] : query.category;
  return categories.find((c) => categoryParam(c.category) === raw) ?? categories[0] ?? null;
}
