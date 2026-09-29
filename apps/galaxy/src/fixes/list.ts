// /visual and /bugs, the lists of fixes (PRD 627): every dossier of one kind — a visual fix's or a bug
// fix's — of the viewer's workspaces, newest activity first, as pure functions of the rows
// dossier_list() gives the viewer (row-level security already left out every other workspace) and the
// filters in the address. Laid out as /prd's list: Mine by default (the fixes the viewer pushed, so one
// the GitHub fallback read shows only under All) or All with `who=all`, a repository (any of a fix's
// repositories), and the words of a title. Each row shows #n (its issue's number), the title, its
// repository chips, what it holds and its last activity, and opens the fix's own page.
import type { ArtifactKind, DossierListRow, WorkKind } from '../dossier/store';
import { KIND_TABS, stamp, TAB_LABELS } from '../dossier/page/view';
import { ofWork, WORK_PATHS, workPath } from '../dossier/page/work';

/** A list of fixes: a visual fix's or a bug fix's. */
export type FixKind = Exclude<WorkKind, 'prd'>;

export type FixFilters = {
  who: 'mine' | 'all';
  /** A repository, owner/name in lower case, as dossier_list() gives them. */
  repo?: string;
  /** Words, each of which must appear in the title. */
  search?: string;
};

/** What the fix holds, and how much of it: `v1`, or `2 rounds` of variations. */
export type FixArtifact = { kind: ArtifactKind; label: string; badge: string };

export type FixItem = {
  id: string;
  href: string;
  /** `#548`: its issue's number. */
  heading: string;
  title: string;
  repos: string[];
  artifacts: FixArtifact[];
  /** `last activity 29 Sep 2026, 09:30 UTC`. */
  activity: string;
  at: string;
};

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first ? first : undefined;
};

/** The filters an address carries: `who` (`all`, or else Mine), `repo`, `q`. */
export function readFixFilters(query: Query): FixFilters {
  const filters: FixFilters = { who: one(query.who) === 'all' ? 'all' : 'mine' };
  const repo = one(query.repo);
  if (repo) filters.repo = repo.toLowerCase();
  const search = one(query.q);
  if (search) filters.search = search;
  return filters;
}

/** Whether any filter but `who` is set: the page then offers to clear them, keeping `who`. */
export const fixFiltered = ({ who: _who, ...rest }: FixFilters) => Object.keys(rest).length > 0;

/** The list's address for these filters: `repo`, `q`, then `who=all` for All (Mine is the default). */
export function fixAddress(kind: FixKind, filters: FixFilters): string {
  const params = new URLSearchParams();
  if (filters.repo) params.set('repo', filters.repo);
  if (filters.search) params.set('q', filters.search);
  if (filters.who === 'all') params.set('who', 'all');
  const query = String(params);
  return query ? `${WORK_PATHS[kind]}?${query}` : WORK_PATHS[kind];
}

function passes(row: DossierListRow, filters: FixFilters, viewer: string | null): boolean {
  if (filters.who === 'mine' && (viewer === null || row.opened_by !== viewer)) return false;
  if (filters.repo && !row.repos.includes(filters.repo)) return false;
  if (filters.search) {
    const title = row.title.toLowerCase();
    if (!filters.search.toLowerCase().split(/\s+/).every((word) => title.includes(word))) return false;
  }
  return true;
}

const newestFirst = (a: DossierListRow, b: DossierListRow) =>
  Date.parse(b.last_activity) - Date.parse(a.last_activity) || a.id.localeCompare(b.id);

const badgeOf = (kind: ArtifactKind, count: number) => (kind === 'variations' ? `${count} round${count === 1 ? '' : 's'}` : `v${count}`);

/** The fixes of `kind` the filters let through for this viewer (their user id), newest activity first. */
export function fixItems(rows: readonly DossierListRow[], kind: FixKind, filters: FixFilters, viewer: string | null): FixItem[] {
  return ofWork(rows, kind).filter((row) => passes(row, filters, viewer)).sort(newestFirst).map((row): FixItem => ({
    id: row.id,
    href: workPath(kind, row.id),
    heading: `#${row.prd}`,
    title: row.title,
    repos: row.repos,
    artifacts: KIND_TABS[kind].flatMap((tab): FixArtifact[] => {
      if (tab === 'questions' || tab === 'outbox' || tab === 'retro') return [];
      const latest = row.latest[tab];
      return latest ? [{ kind: tab, label: TAB_LABELS[tab], badge: badgeOf(tab, latest.version) }] : [];
    }),
    activity: `last activity ${stamp(row.last_activity)}`,
    at: row.last_activity,
  }));
}

/** What the repository filter offers: every repository of every fix of `kind`, once each, in order. */
export function fixChoices(rows: readonly DossierListRow[], kind: FixKind): { repos: string[] } {
  return { repos: [...new Set(ofWork(rows, kind).flatMap((row) => row.repos))].sort() };
}
