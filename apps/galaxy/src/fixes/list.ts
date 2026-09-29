// /visual and /bugs, the lists of fixes (PRD 627): every dossier of one kind — a visual fix's or a bug
// fix's — of the viewer's workspaces, newest activity first, as pure functions of the rows
// dossier_list() gives the viewer (row-level security already left out every other workspace) and the
// filters in the address. Laid out as /prd's list: Mine by default (the fixes the viewer pushed or whose
// issue they opened, issue 674: the GitHub fallback reads most fixes, so none of those is pushed) or All with `who=all`, a repository (any of a fix's
// repositories), and the words of a title. Each row shows #n (its issue's number), the title, its
// repository chips, what it holds and its last activity, and opens the fix's own page.
// PRD 627, s5: each row also shows who asked and its state pill — Asked, In review, Merged, or `—` when
// GitHub did not answer (./timeline.ts) — and a bug fix's row its issue's risk label and a *regression*
// badge; the state is a filter too (`state=asked|in-review|merged`). What GitHub said of each fix is
// handed in by the route, read through the page's one cached reader.
import type { FixIssue, FixSummary } from '../dossier/github/fix';
import { UNREAD } from '../dossier/github/summary';
import type { ArtifactKind, DossierListRow, WorkKind } from '../dossier/store';
import { isArtifactTab, KIND_TABS, stamp, TAB_LABELS } from '../dossier/page/view';
import { fixState, STATE_LABELS, type FixState } from './timeline';
import { ofWork, WORK_PATHS, workPath } from '../dossier/page/work';

/** A list of fixes: a visual fix's or a bug fix's. */
export type FixKind = Exclude<WorkKind, 'prd'>;

export type FixFilters = {
  who: 'mine' | 'all';
  /** A repository, owner/name in lower case, as dossier_list() gives them. */
  repo?: string;
  /** Words, each of which must appear in the title. */
  search?: string;
  /** Only the fixes in this state (PRD 627, s5). */
  state?: FixState;
};

const STATES: readonly FixState[] = ['asked', 'in-review', 'merged'];
const isFixState = (value: unknown): value is FixState => STATES.includes(value as FixState);

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
  /** `asked by @anna`; null when GitHub did not say. */
  asked: string | null;
  /** The state pill: `Asked`, `In review`, `Merged`, or `—` when GitHub did not answer. */
  state: FixState | null;
  stateLabel: string;
  /** A bug fix's issue risk label (`omni:risk-high`); null when it has none, or for a visual fix. */
  risk: string | null;
  /** A bug fix whose issue carries the regression label. */
  regression: boolean;
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
  const state = one(query.state);
  if (isFixState(state)) filters.state = state;
  return filters;
}

/** Whether any filter but `who` is set: the page then offers to clear them, keeping `who`. */
export const fixFiltered = ({ who: _who, ...rest }: FixFilters) => Object.keys(rest).length > 0;

/** The list's address for these filters: `repo`, `q`, then `who=all` for All (Mine is the default). */
export function fixAddress(kind: FixKind, filters: FixFilters): string {
  const params = new URLSearchParams();
  if (filters.repo) params.set('repo', filters.repo);
  if (filters.search) params.set('q', filters.search);
  if (filters.state) params.set('state', filters.state);
  if (filters.who === 'all') params.set('who', 'all');
  const query = String(params);
  return query ? `${WORK_PATHS[kind]}?${query}` : WORK_PATHS[kind];
}

/** Who reads the list: their user id and their GitHub login, when they signed in with GitHub. */
export type FixViewer = { id: string; login: string | null };

/** Mine (issue 674): a fix the viewer pushed, or whose issue they opened; the sync pushes most fixes. */
function isMine(row: DossierListRow, viewer: FixViewer | null, fix: FixSummary | null): boolean {
  if (viewer === null) return false;
  const author = issueOf(fix)?.author;
  return row.opened_by === viewer.id || (!!author && !!viewer.login && author.toLowerCase() === viewer.login.toLowerCase());
}

function passes(row: DossierListRow, filters: FixFilters, viewer: FixViewer | null, fix: FixSummary | null): boolean {
  if (filters.who === 'mine' && !isMine(row, viewer, fix)) return false;
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

/** What GitHub said of each fix, by dossier id; a fix left out reads as GitHub not answering. */
export type FixFacts = ReadonlyMap<string, FixSummary | null>;

/** The fixes of `kind` the filters let through for this viewer, newest activity first. */
export function fixItems(
  rows: readonly DossierListRow[], kind: FixKind, filters: FixFilters, viewer: FixViewer | null, facts: FixFacts = new Map(),
): FixItem[] {
  const factsOf = (row: DossierListRow) => facts.get(row.id) ?? null;
  return ofWork(rows, kind).filter((row) => passes(row, filters, viewer, factsOf(row)))
    .filter((row) => !filters.state || fixState(factsOf(row)) === filters.state)
    .sort(newestFirst).map((row): FixItem => ({
    id: row.id,
    href: workPath(kind, row.id),
    heading: `#${row.prd}`,
    title: row.title,
    repos: row.repos,
    artifacts: KIND_TABS[kind].flatMap((tab): FixArtifact[] => {
      if (!isArtifactTab(tab)) return [];
      const latest = row.latest[tab];
      return latest ? [{ kind: tab, label: TAB_LABELS[tab], badge: badgeOf(tab, latest.version) }] : [];
    }),
    activity: `last activity ${stamp(row.last_activity)}`,
    at: row.last_activity,
    ...githubFacts(kind, factsOf(row)),
  }));
}

/** The fix's issue, when GitHub gave it. */
const issueOf = (fix: FixSummary | null): FixIssue | null => (fix === null || fix.issue === UNREAD ? null : fix.issue);

/** Who asked: the issue's author, when GitHub said. */
const askedBy = (issue: FixIssue | null) => (issue?.author ? `asked by @${issue.author}` : null);

/** A bug fix's risk label and regression badge; none for a visual fix, or when GitHub did not say. */
const bugLabels = (kind: FixKind, issue: FixIssue | null): Pick<FixItem, 'risk' | 'regression'> =>
  (kind === 'bug' && issue !== null ? { risk: issue.risk, regression: issue.regression } : { risk: null, regression: false });

function githubFacts(kind: FixKind, fix: FixSummary | null): Pick<FixItem, 'asked' | 'state' | 'stateLabel' | 'risk' | 'regression'> {
  const state = fixState(fix);
  const issue = issueOf(fix);
  return { asked: askedBy(issue), state, stateLabel: STATE_LABELS[state ?? 'unknown'], ...bugLabels(kind, issue) };
}

/** What the repository filter offers: every repository of every fix of `kind`, once each, in order. */
export function fixChoices(rows: readonly DossierListRow[], kind: FixKind): { repos: string[] } {
  return { repos: [...new Set(ofWork(rows, kind).flatMap((row) => row.repos))].sort() };
}
