// /prd, the history (PRD 216's spec, "The pages"): every dossier of the viewer's workspaces, newest
// activity first (the latest of its opening, its numbering, its versions and its questions), as pure
// functions of the rows dossier_list() gives the viewer (row-level security already left out every
// other workspace) and the filters in the address. Filtered by repository — any of a dossier's
// repositories: its home, its questions' and its planet's regions, so a dossier with three shows under
// each — and by draft or PRD, and searched by the words of a title. Each row shows #n or DRAFT, the
// title, its repository chips, which artifacts it has and how many versions of each, and its questions
// answered out of asked, and opens /prd/<id>. PRD 413: Mine by default — the dossiers the viewer opened,
// drafts and numbered alike, so one the GitHub fallback created (no opener) shows only under All — and All
// with `who=all`; who combines with every other filter, and clearing the filters keeps it.
//
// PRD 251 (s10): a numbered row whose outbox has open questions shows `n open`, the Outbox tab's own
// count (the open items), only for the numbered rows the other filters let through (historyToRead).
// Needs an answer (`needs=answer`) keeps only those rows; a row whose outbox could not be read counts as
// none. PRD 657 (s5): the counts are read from prd_outbox, which the stages sync, the stage events and
// the sends fill (readOpenCounts), so the list makes no GitHub read; they may lag up to 15 minutes.
//
// PRD 587 (s4): each row shows its current stage as a pill — a numbered PRD's from its stored stages
// (readCurrentStages, through the stage store, as the viewer), a draft's idea once any of its questions is
// answered, and none for a draft with no answer or a PRD not synced yet. A stage bar above the list counts
// the seven stages over the rows every other filter keeps, and `stage=<id>` keeps only the rows at it.
//
// PRD 698 (s4): `who=<login>` keeps the dossiers that person opened, by the rule Mine uses for the viewer
// (opened_by): the route resolves the login to the account ids it holds in the viewer's workspaces
// (readLoginIds, through workspace_roster, as the viewer) and hands them in as `whom`. Neither Mine nor All
// is then pressed; the page says whose PRDs these are.
import { isStage, STAGE_LABELS, STAGES, type StageId, type StoredStage } from '../../stages/stage';
import { prdKey, type PrdRef, type StageStore } from '../../stages/store';
import type { PrdOutboxStore } from '../../stages/outbox/store';
import type { DossierKind, DossierListRow } from '../store';
import { dossierPath, stamp, TAB_LABELS, TABS } from './view';

/** The history's own address, and where its sign-in comes back to. */
export const HISTORY_PATH = '/prd';
export const HISTORY_CALLBACK = '/prd/callback';

/** Mine (the dossiers the viewer opened), All (every dossier of the viewer's workspaces), or one person's
 * (PRD 698: `who=<login>`, their GitHub login in lower case). */
export type HistoryWho = 'mine' | 'all' | { login: string };

/** A GitHub login as `who=` may carry one: letters, digits and single hyphens, at most 39, not led by a hyphen. */
const LOGIN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;

/** What `who=` says (PRD 413, 698): `all`, a GitHub login (lower-cased), or else Mine — `mine`, missing,
 * blank, malformed, or a login spelling mine or all in another case. Shared with the fix lists. */
export function readWho(value: string | undefined): HistoryWho {
  if (value === 'all') return 'all';
  const login = value?.toLowerCase();
  return login && login !== 'mine' && login !== 'all' && LOGIN.test(login) ? { login } : 'mine';
}

/** `who`'s value in an address: none for Mine (the default), `all`, or the login. */
export const whoParam = (who: HistoryWho): string | null => (who === 'mine' ? null : who === 'all' ? 'all' : who.login);

/** The login a list is narrowed to under `who=<login>`, else null. */
export const whoLogin = (who: HistoryWho): string | null => (typeof who === 'object' ? who.login : null);

/** What the history is narrowed to: `who` always, and each other filter left out lets every dossier through. */
export type HistoryFilters = {
  who: HistoryWho;
  /** A repository, owner/name in lower case, as dossier_list() gives them. */
  repo?: string;
  state?: 'draft' | 'prd';
  /** Words, each of which must appear in the title. */
  search?: string;
  /** Only the dossiers whose outbox has open questions (PRD 251). */
  needsAnswer?: true;
  /** Only the dossiers at this stage now (PRD 587). */
  stage?: StageId;
};

/** Each numbered dossier's current stored stage, by stageKeyOf; one left out has no stored stage yet. */
export type CurrentStages = ReadonlyMap<string, StoredStage>;

/** A numbered dossier's key among the current stages: its workspace, then its PRD's key. */
export const stageKeyOf = (row: Pick<DossierListRow, 'workspace_id' | 'home_repo' | 'prd'>) =>
  `${row.workspace_id} ${prdKey({ repository: row.home_repo, prd: row.prd ?? 0 })}`;

/** One stop of the stage bar: how many rows sit at it, and the list filtered to it (or cleared, when selected). */
export type StageBarEntry = { id: StageId; label: string; count: number; href: string; selected: boolean };

/** Each dossier's open outbox questions, by its id; a dossier left out was not read, and counts as none. */
export type OpenCounts = ReadonlyMap<string, number>;

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
  /** `2 open`: its outbox's open questions (PRD 251); null when none, or not read. */
  open: string | null;
  /** Its current stage (PRD 587); null for a draft with no answer, or a PRD not synced yet. */
  stage: StageId | null;
  /** `last activity 28 Sep 2026, 08:00 UTC`. */
  activity: string;
  at: string;
};

type Query = Record<string, string | string[] | undefined>;

/** A parameter's first value, trimmed; undefined when absent or blank. */
const one = (value: string | string[] | undefined) => [value].flat()[0]?.trim() || undefined;

/** The filters an address carries: `who` (`all`, a login, or else Mine), `repo`, `state` (`draft` or `prd`), `q`, `needs` (`answer`),
 * `stage` (one of the seven; anything else is no filter). */
export function readHistoryFilters(query: Query): HistoryFilters {
  const filters: HistoryFilters = { who: readWho(one(query.who)) };
  const repo = one(query.repo);
  if (repo) filters.repo = repo.toLowerCase();
  const state = one(query.state);
  if (state === 'draft' || state === 'prd') filters.state = state;
  const search = one(query.q);
  if (search) filters.search = search;
  if (one(query.needs) === 'answer') filters.needsAnswer = true;
  const stage = one(query.stage);
  if (isStage(stage)) filters.stage = stage;
  return filters;
}

/** Whether any filter but `who` is set: the page then offers to clear them, keeping `who`. */
export const filtered = ({ who: _who, ...rest }: HistoryFilters) => Object.keys(rest).length > 0;

/** The history's address for these filters: `repo`, `state`, `q`, `needs`, `stage`, then `who=all` for All or
 * `who=<login>` for one person (Mine is the default). */
export function historyAddress(filters: HistoryFilters): string {
  const params = new URLSearchParams();
  if (filters.repo) params.set('repo', filters.repo);
  if (filters.state) params.set('state', filters.state);
  if (filters.search) params.set('q', filters.search);
  if (filters.needsAnswer) params.set('needs', 'answer');
  if (filters.stage) params.set('stage', filters.stage);
  const who = whoParam(filters.who);
  if (who) params.set('who', who);
  const query = params.toString();
  return query ? `${HISTORY_PATH}?${query}` : HISTORY_PATH;
}

const openOf = (row: DossierListRow, open: OpenCounts) => open.get(row.id) ?? 0;

/** A row's current stage: its stored one when numbered, idea for a draft with an answer, else none. */
function stageOfRow(row: DossierListRow, stages: CurrentStages): StageId | null {
  if (row.prd === null) return row.answered > 0 ? 'idea' : null;
  return stages.get(stageKeyOf(row)) ?? null;
}

/** The account ids a login holds in the viewer's workspaces (PRD 698), as readLoginIds finds them. */
export type Whom = ReadonlySet<string>;

const NOBODY: Whom = new Set();

/** Whether the row's opener is whom `who` names: the viewer for Mine, one of `whom`'s ids for a login. */
function opensFor(row: DossierListRow, who: HistoryWho, viewer: string | null, whom: Whom): boolean {
  if (who === 'all') return true;
  if (row.opened_by === null) return false;
  return who === 'mine' ? row.opened_by === viewer : whom.has(row.opened_by);
}

/** The filters on where a row is and who it waits on: its stage, Mine or one person's, Needs an answer. */
function passesProgress(
  row: DossierListRow, filters: HistoryFilters, viewer: string | null, open: OpenCounts, stages: CurrentStages, whom: Whom,
): boolean {
  if (filters.stage && stageOfRow(row, stages) !== filters.stage) return false;
  if (!opensFor(row, filters.who, viewer, whom)) return false;
  return !(filters.needsAnswer && openOf(row, open) === 0);
}

/** Whether every word searched is in the title, ignoring case. */
const titleHas = (title: string, search: string) => {
  const words = title.toLowerCase();
  return search.toLowerCase().split(/\s+/).every((word) => words.includes(word));
};

/** The filters on what a row is: its repository, draft or PRD, and the words of its title. */
function passesContent(row: DossierListRow, filters: HistoryFilters): boolean {
  if (filters.repo && !row.repos.includes(filters.repo)) return false;
  if (filters.state === 'draft' && row.prd !== null) return false;
  if (filters.state === 'prd' && row.prd === null) return false;
  return !filters.search || titleHas(row.title, filters.search);
}

function passes(
  row: DossierListRow, filters: HistoryFilters, viewer: string | null, open: OpenCounts, stages: CurrentStages = new Map(), whom: Whom = NOBODY,
): boolean {
  return passesProgress(row, filters, viewer, open, stages, whom) && passesContent(row, filters);
}

const newestFirst = (a: DossierListRow, b: DossierListRow) =>
  Date.parse(b.last_activity) - Date.parse(a.last_activity) || a.id.localeCompare(b.id);

/** The numbered dossiers every filter but Needs an answer and the stage lets through, newest activity
 * first: the ones whose open questions the history reads (the stage bar counts over them too). */
export function historyToRead(rows: DossierListRow[], filters: HistoryFilters, viewer: string | null, whom: Whom = NOBODY): DossierListRow[] {
  const { needsAnswer: _needs, stage: _stage, ...rest } = filters;
  return rows.filter((row) => row.prd !== null && passes(row, rest, viewer, new Map(), new Map(), whom)).sort(newestFirst);
}

/** A workspace's members as workspace_roster gives them to the viewer: their account id and login. */
type RosterReader = (workspace: string) => Promise<ReadonlyArray<{ user_id: string; github_login: string | null }>>;

/** The account ids `login` holds (ignoring case) in the workspaces of `rows` (PRD 698), each workspace's roster
 * read once, as the viewer, so only workspaces they share count. A roster that cannot be read adds none. */
export async function readLoginIds(rows: readonly Pick<DossierListRow, 'workspace_id'>[], login: string, roster: RosterReader): Promise<Set<string>> {
  const ids = new Set<string>();
  const wanted = login.toLowerCase();
  await Promise.all([...new Set(rows.map((row) => row.workspace_id))].map(async (workspace) => {
    try {
      for (const member of await roster(workspace)) if (member.github_login?.toLowerCase() === wanted) ids.add(member.user_id);
    } catch (error) {
      console.error(`who=${login}: the members of workspace ${workspace} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  return ids;
}

/** A reader of the stored outboxes (PRD 657, s5): prd_outbox, as the viewer. */
type OpenReader = Pick<PrdOutboxStore, 'countsOf'>;

/** Each numbered dossier's open outbox questions, as the stages sync last stored them in prd_outbox,
 * read per workspace all at once; no GitHub read. A dossier with no stored count is left out, and so is
 * every dossier of a workspace whose outboxes could not be read; no reader, none. */
export async function readOpenCounts(rows: readonly DossierListRow[], reader: OpenReader | null): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!reader) return counts;
  const byWorkspace = new Map<string, DossierListRow[]>();
  for (const row of rows) {
    if (row.prd === null) continue;
    byWorkspace.set(row.workspace_id, [...(byWorkspace.get(row.workspace_id) ?? []), row]);
  }
  await Promise.all([...byWorkspace].map(async ([workspace, numbered]) => {
    try {
      const stored = await reader.countsOf(workspace, numbered.map((row) => ({ repository: row.home_repo, prd: row.prd ?? 0 })));
      for (const row of numbered) {
        const count = stored.get(prdKey({ repository: row.home_repo, prd: row.prd ?? 0 }));
        if (count) counts.set(row.id, count.open_questions);
      }
    } catch (error) {
      console.error(`PRD history: the outboxes of workspace ${workspace} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  return counts;
}

/** A reader of the stored stages: the stage store, as the viewer. */
type StagesReader = Pick<StageStore, 'currentStages'>;

/** The current stored stage of each numbered dossier among `rows`, read per workspace all at once. A
 * workspace whose stages could not be read, or no reader, leaves its dossiers out: they show no stage. */
export async function readCurrentStages(rows: readonly DossierListRow[], reader: StagesReader | null): Promise<Map<string, StoredStage>> {
  const stages = new Map<string, StoredStage>();
  if (!reader) return stages;
  const byWorkspace = new Map<string, PrdRef[]>();
  for (const row of rows) {
    if (row.prd === null) continue;
    byWorkspace.set(row.workspace_id, [...(byWorkspace.get(row.workspace_id) ?? []), { repository: row.home_repo, prd: row.prd }]);
  }
  await Promise.all([...byWorkspace].map(async ([workspace, prds]) => {
    try {
      const current = await reader.currentStages(workspace, prds);
      for (const [key, stage] of current) stages.set(`${workspace} ${key}`, stage);
    } catch (error) {
      console.error(`PRD history: the stages of workspace ${workspace} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  return stages;
}

/** The stage bar: the seven stages in track order, each counting the rows every filter but the stage lets
 * through, and linking to the list filtered to it — or, for the stage selected, to the list without it. */
export function historyStageBar(
  rows: DossierListRow[], filters: HistoryFilters, viewer: string | null, open: OpenCounts = new Map(), stages: CurrentStages = new Map(),
  whom: Whom = NOBODY,
): StageBarEntry[] {
  const { stage: selected, ...rest } = filters;
  const counts = new Map<StageId, number>();
  for (const row of rows) {
    if (!passes(row, rest, viewer, open, new Map(), whom)) continue;
    const stage = stageOfRow(row, stages);
    if (stage) counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  return STAGES.map((id) => ({
    id,
    label: STAGE_LABELS[id],
    count: counts.get(id) ?? 0,
    href: historyAddress(id === selected ? rest : { ...rest, stage: id }),
    selected: id === selected,
  }));
}

/** The dossiers the filters let through for this viewer (their user id), newest activity first, as the
 * history lists them; `open` gives each one's open outbox questions (PRD 251), `stages` each numbered
 * one's current stored stage (PRD 587); `whom`, under `who=<login>`, the ids that login holds (PRD 698). */
export function historyItems(
  rows: DossierListRow[], filters: HistoryFilters, viewer: string | null, open: OpenCounts = new Map(), stages: CurrentStages = new Map(),
  whom: Whom = NOBODY,
): HistoryItem[] {
  return rows.filter((row) => passes(row, filters, viewer, open, stages, whom)).sort(newestFirst).map((row): HistoryItem => ({
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
    open: openOf(row, open) > 0 ? `${openOf(row, open)} open` : null,
    stage: stageOfRow(row, stages),
    activity: `last activity ${stamp(row.last_activity)}`,
    at: row.last_activity,
  }));
}

/** What the repository filter offers: every repository of every dossier, once each, in order. */
export function historyChoices(rows: DossierListRow[]): { repos: string[] } {
  return { repos: [...new Set(rows.flatMap((row) => row.repos))].sort() };
}
