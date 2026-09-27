// /prd, the history (PRD 216's spec, "The pages"): every dossier of the viewer's workspaces, newest
// activity first (the latest of its opening, its numbering, its versions and its questions), as pure
// functions of the rows dossier_list() gives the viewer (row-level security already left out every
// other workspace) and the filters in the address. Filtered by repository — any of a dossier's
// repositories: its home, its questions' and its planet's regions, so a dossier with three shows under
// each — and by draft or PRD, and searched by the words of a title. Each row shows #n or DRAFT, the
// title, its repository chips, which artifacts it has and how many versions of each, and its questions
// answered out of asked, and opens /prd/<id>.
import type { DossierKind, DossierListRow } from '../store';
import { dossierPath, stamp, TAB_LABELS, TABS } from './view';

/** The history's own address, and where its sign-in comes back to. */
export const HISTORY_PATH = '/prd';
export const HISTORY_CALLBACK = '/prd/callback';

/** What the history is narrowed to: each filter left out lets every dossier through. */
export type HistoryFilters = {
  /** A repository, owner/name in lower case, as dossier_list() gives them. */
  repo?: string;
  state?: 'draft' | 'prd';
  /** Words, each of which must appear in the title. */
  search?: string;
};

/** An artifact the dossier has, and how many versions of it (`v3`). */
export type ArtifactEntry = { kind: DossierKind; label: string; badge: string };

export type HistoryItem = {
  id: string;
  href: string;
  /** `#216`, or `DRAFT`. */
  heading: string;
  draft: boolean;
  title: string;
  repos: string[];
  /** The artifacts it has, in the page's tab order. */
  artifacts: ArtifactEntry[];
  /** `11/12 answered`, or `no question yet`. */
  questions: string;
  /** `last activity 28 Sep 2026, 08:00 UTC`. */
  activity: string;
  at: string;
};

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first ? first : undefined;
};

/** The filters an address carries: `repo`, `state` (`draft` or `prd`), `q`. */
export function readHistoryFilters(query: Query): HistoryFilters {
  const filters: HistoryFilters = {};
  const repo = one(query.repo);
  if (repo) filters.repo = repo.toLowerCase();
  const state = one(query.state);
  if (state === 'draft' || state === 'prd') filters.state = state;
  const search = one(query.q);
  if (search) filters.search = search;
  return filters;
}

/** Whether any filter is set: the page then offers to clear them. */
export const filtered = (filters: HistoryFilters) => Object.keys(filters).length > 0;

function passes(row: DossierListRow, filters: HistoryFilters): boolean {
  if (filters.repo && !row.repos.includes(filters.repo)) return false;
  if (filters.state === 'draft' && row.prd !== null) return false;
  if (filters.state === 'prd' && row.prd === null) return false;
  if (filters.search) {
    const title = row.title.toLowerCase();
    if (!filters.search.toLowerCase().split(/\s+/).every((word) => title.includes(word))) return false;
  }
  return true;
}

const newestFirst = (a: DossierListRow, b: DossierListRow) =>
  Date.parse(b.last_activity) - Date.parse(a.last_activity) || a.id.localeCompare(b.id);

/** The dossiers the filters let through, newest activity first, as the history lists them. */
export function historyItems(rows: DossierListRow[], filters: HistoryFilters): HistoryItem[] {
  return rows.filter((row) => passes(row, filters)).sort(newestFirst).map((row): HistoryItem => ({
    id: row.id,
    href: dossierPath(row.id),
    heading: row.prd === null ? 'DRAFT' : `#${row.prd}`,
    draft: row.prd === null,
    title: row.title,
    repos: row.repos,
    artifacts: TABS.flatMap((kind): ArtifactEntry[] => {
      if (kind === 'questions') return [];
      const latest = row.latest[kind];
      return latest ? [{ kind, label: TAB_LABELS[kind], badge: `v${latest.version}` }] : [];
    }),
    questions: row.asked > 0 ? `${row.answered}/${row.asked} answered` : 'no question yet',
    activity: `last activity ${stamp(row.last_activity)}`,
    at: row.last_activity,
  }));
}

/** What the repository filter offers: every repository of every dossier, once each, in order. */
export function historyChoices(rows: DossierListRow[]): { repos: string[] } {
  return { repos: [...new Set(rows.flatMap((row) => row.repos))].sort() };
}
