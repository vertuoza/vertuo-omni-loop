import { brusselsDay, type PeriodWindow } from '../dashboard/board/period';

// The Engineering board's math (PRD 612 s3), pure, so the loader, the demo and the tests draw the
// same board. It reads the rows omni-app's prStats collector writes (public.pull_requests and
// public.pull_request_reviews) and keeps only those of the workspace's tracked repositories: an
// untracked repository counts nowhere. The spec's counting rules, over a period's window [from, to):
//
// - opened: opened_at in the window, credited to the author;
// - merged: merged_at in the window, credited to merged_by, who pressed Merge;
// - open now: neither merged_at nor closed_at, whatever the window;
// - time to merge: merged_at − opened_at, a median over the PRs merged in the window;
// - commits and lines: summed over the PRs merged in the window;
// - reviews: first_at in the window, once per reviewer per PR, never by the PR's author;
// - every base branch counts. Bots count in the tiles and the table, never in the people lists;
//   Omni-man has the Omni Loop panel instead.

/** Omni-man's GitHub login: the Omni Loop App's bot. */
export const OMNI_MAN = 'omni-loop-invader[bot]';

/** One row of public.pull_requests, as the board reads it. */
export interface PullRequestRow {
  repo: string;
  number: number;
  author: string | null;
  authorIsBot: boolean;
  openedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  mergedBy: string | null;
  commits: number;
  additions: number;
  deletions: number;
  omniSigned: boolean;
}

/** One row of public.pull_request_reviews: a reviewer's first review of a PR. */
export interface ReviewRow {
  repo: string;
  number: number;
  reviewer: string;
  firstAt: string;
}

/** What the board is drawn from: the tracked repositories, and the rows read for the window. */
export interface EngineeringRead {
  tracked: string[];
  pullRequests: PullRequestRow[];
  reviews: ReviewRow[];
}

export interface EngineeringTiles {
  opened: number;
  merged: number;
  openNow: number;
  /** In milliseconds; null with nothing merged. */
  medianToMerge: number | null;
  commits: number;
  additions: number;
  deletions: number;
}

export interface RepositoryStats {
  repo: string;
  opened: number;
  merged: number;
  openNow: number;
  medianToMerge: number | null;
  commits: number;
  /** Additions and deletions together. */
  lines: number;
}

export interface Ranked { login: string; count: number }

export interface OmniPanel {
  /** Merged PRs Omni-man signed, of every merged PR. */
  merged: number;
  of: number;
  /** A whole percent; null with nothing merged. */
  share: number | null;
  medianSigned: number | null;
  medianRest: number | null;
  additions: number;
  deletions: number;
}

export interface MergedDay { date: string; signed: number; rest: number }

export type EngineeringValue =
  | { kind: 'empty'; window: PeriodWindow }
  | {
    kind: 'board';
    window: PeriodWindow;
    sort: SortKey;
    tiles: EngineeringTiles;
    repositories: RepositoryStats[];
    people: { opened: Ranked[]; merged: Ranked[]; reviews: Ranked[] };
    omni: OmniPanel;
    perDay: MergedDay[];
  };

// ── Sorting the table ───────────────────────────────────────────────────

export type SortKey = 'repo' | 'opened' | 'merged' | 'open' | 'time' | 'commits' | 'lines';

/** The table's columns, in order, and the query value that sorts by each. */
export const SORTS: readonly { id: SortKey; label: string }[] = [
  { id: 'repo', label: 'Repository' },
  { id: 'opened', label: 'Opened' },
  { id: 'merged', label: 'Merged' },
  { id: 'open', label: 'Open now' },
  { id: 'time', label: 'Median time to merge' },
  { id: 'commits', label: 'Commits' },
  { id: 'lines', label: 'Lines' },
];

/** The sort a query value names: merged, for anything unknown. */
export function sortOf(value: string | string[] | null | undefined): SortKey {
  return SORTS.some((s) => s.id === value) ? (value as SortKey) : 'merged';
}

const COUNT_OF: Record<Exclude<SortKey, 'repo' | 'time'>, (r: RepositoryStats) => number> = {
  opened: (r) => r.opened, merged: (r) => r.merged, open: (r) => r.openNow, commits: (r) => r.commits, lines: (r) => r.lines,
};

/** Most first, the name breaking ties; by name A to Z; by time to merge fastest first, none last. */
function sortRows(rows: RepositoryStats[], sort: SortKey): RepositoryStats[] {
  const byName = (a: RepositoryStats, b: RepositoryStats) => a.repo.localeCompare(b.repo);
  if (sort === 'repo') return [...rows].sort(byName);
  if (sort === 'time') {
    const t = (r: RepositoryStats) => r.medianToMerge ?? Number.POSITIVE_INFINITY;
    return [...rows].sort((a, b) => t(a) - t(b) || byName(a, b));
  }
  const of = COUNT_OF[sort];
  return [...rows].sort((a, b) => of(b) - of(a) || byName(a, b));
}

// ── The pieces ──────────────────────────────────────────────────────────

/** The median of some numbers: the middle one, the mean of the two middle ones, or null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A duration as the board says it: `42 min`, `4.1 h`, `3.0 d`; a dash for none. */
export function durationWords(ms: number | null): string {
  if (ms === null) return '–';
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} min`;
  if (ms < 48 * HOUR) return `${(ms / HOUR).toFixed(1)} h`;
  return `${(ms / (24 * HOUR)).toFixed(1)} d`;
}

/** A bot account: a login ending in `[bot]`, Omni-man's included. */
export function isBot(login: string | null | undefined): boolean {
  return typeof login === 'string' && login.toLowerCase().endsWith('[bot]');
}

/** The five logins seen most, most first, ties in login order. */
export function topFive(logins: readonly (string | null)[]): Ranked[] {
  const counts = new Map<string, number>();
  for (const login of logins) if (login) counts.set(login, (counts.get(login) ?? 0) + 1);
  return [...counts]
    .map(([login, count]) => ({ login, count }))
    .sort((a, b) => b.count - a.count || a.login.localeCompare(b.login))
    .slice(0, 5);
}

const person = (login: string | null) => (login && !isBot(login) && login.toLowerCase() !== OMNI_MAN ? login : null);
const toMerge = (p: PullRequestRow) => Date.parse(p.mergedAt!) - Date.parse(p.openedAt);

function statsOf(repo: string, prs: readonly PullRequestRow[], inWindow: (at: string | null) => boolean): RepositoryStats & EngineeringTiles {
  const merged = prs.filter((p) => inWindow(p.mergedAt));
  const additions = merged.reduce((s, p) => s + p.additions, 0);
  const deletions = merged.reduce((s, p) => s + p.deletions, 0);
  return {
    repo,
    opened: prs.filter((p) => inWindow(p.openedAt)).length,
    merged: merged.length,
    openNow: prs.filter((p) => !p.mergedAt && !p.closedAt).length,
    medianToMerge: median(merged.map(toMerge)),
    commits: merged.reduce((s, p) => s + p.commits, 0),
    additions, deletions, lines: additions + deletions,
  };
}

// ── The board ───────────────────────────────────────────────────────────

export function engineeringOf(read: EngineeringRead, window: PeriodWindow, sort: SortKey): EngineeringValue {
  const tracked = new Set(read.tracked.map((r) => r.toLowerCase()));
  if (tracked.size === 0) return { kind: 'empty', window };
  const from = window.from.getTime(), to = window.to.getTime();
  const inWindow = (at: string | null) => {
    if (!at) return false;
    const t = Date.parse(at);
    return t >= from && t < to;
  };
  const prs = read.pullRequests.filter((p) => tracked.has(p.repo.toLowerCase()));
  const merged = prs.filter((p) => inWindow(p.mergedAt));

  const { repo: _all, lines: _lines, ...tiles } = statsOf('', prs, inWindow);
  const repositories = sortRows(
    [...tracked].map((repo) => {
      const { additions: _a, deletions: _d, ...row } = statsOf(repo, prs.filter((p) => p.repo.toLowerCase() === repo), inWindow);
      return row;
    }),
    sort,
  );

  const authorOf = new Map(prs.map((p) => [`${p.repo.toLowerCase()}#${p.number}`, p.author?.toLowerCase() ?? null]));
  const reviews = read.reviews.filter((r) =>
    tracked.has(r.repo.toLowerCase()) && inWindow(r.firstAt) && authorOf.get(`${r.repo.toLowerCase()}#${r.number}`) !== r.reviewer.toLowerCase());
  const people = {
    opened: topFive(prs.filter((p) => inWindow(p.openedAt) && !p.authorIsBot).map((p) => person(p.author))),
    merged: topFive(merged.map((p) => person(p.mergedBy))),
    reviews: topFive(reviews.map((r) => person(r.reviewer))),
  };

  const signed = merged.filter((p) => p.omniSigned);
  const omni: OmniPanel = {
    merged: signed.length,
    of: merged.length,
    share: merged.length ? Math.round((signed.length / merged.length) * 100) : null,
    medianSigned: median(signed.map(toMerge)),
    medianRest: median(merged.filter((p) => !p.omniSigned).map(toMerge)),
    additions: signed.reduce((s, p) => s + p.additions, 0),
    deletions: signed.reduce((s, p) => s + p.deletions, 0),
  };

  const perDay = window.days.map((date) => ({ date, signed: 0, rest: 0 }));
  const dayAt = new Map(perDay.map((d) => [d.date, d]));
  for (const p of merged) {
    const day = dayAt.get(brusselsDay(p.mergedAt!) ?? '');
    if (day) p.omniSigned ? day.signed++ : day.rest++;
  }

  return { kind: 'board', window, sort, tiles, repositories, people, omni, perDay };
}
