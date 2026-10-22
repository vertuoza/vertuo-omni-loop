import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { People } from '../people/load';
import type { Person } from '../people/types';

// The Waiting board's model (PRD 2377 s3, s4), pure: the stored waits of a workspace, as /app/waiting's
// three tabs draw them (s4: My PRDs and My reviews beside Workspace). Every open wait, oldest first, each with the PRD (or the pull request of a
// bug fix or a visual update) and its pull request linked, what it waits on in words, whose turn as
// faces (a team by its name), and how long in working days (Monday to Friday, UTC): `today` under one,
// red past the escalation limit. Under the tabs, one line names any tracked repository the stages sync
// last read more than half an hour ago, or never. It reads nothing and makes no GitHub request.

/** The kinds of wait the sync records (stages/sync/waits.ts). */
export type WaitKind = 'approval' | 'outbox' | 'law' | 'review' | 'merge';

/** One open wait, as it is stored. */
export interface StoredWait {
  id: string;
  repo: string;
  prd: PrdNumber | null;
  pr: PrNumber | null;
  kind: WaitKind;
  /** GitHub logins and `org/team`s; empty for "any approver" / "anyone who can merge". */
  turn: readonly string[];
  since: string;
}

/** A PRD's dossier: its id (the page's address) and its title. */
export interface PrdPage {
  id: string;
  title: string;
  /** The account that opened the dossier, the PRD's owner; null when none is recorded. */
  owner: string | null;
}

/** The person reading the board: their account id and their GitHub login, in lower case, when they have one. */
export interface Viewer {
  id: string;
  login: string | null;
}

/** What the board is drawn from. A map is keyed by `prdKey` (the repository in lower case, then `#`, the number). */
export interface BoardInput {
  waits: readonly StoredWait[];
  dossiers: ReadonlyMap<string, PrdPage>;
  /** The open outbox questions of each PRD. */
  questions: ReadonlyMap<string, number>;
  /** The workspace's tracked repositories, each with when the sync last read it (null: never). */
  synced: ReadonlyMap<string, string | null>;
  now: Date;
  /** Whose board it is: My PRDs and My reviews are theirs. */
  viewer: Viewer;
  tab: TabId;
}

/** The key of a PRD in a workspace. */
export const prdKey = (repo: string, prd: PrdNumber): string => `${repo.toLowerCase()}#${prd}`;

/** A wait older than this many working days reads red: `limits.escalationWorkingDays`'s default. */
const ESCALATION_WORKING_DAYS = 2;

/** A repository the sync last read longer ago than this is named under the tabs. */
const STALE_AFTER_MS = 30 * 60_000;

const DAY_MS = 86_400_000;

/** The working time between two instants, in ms: every Saturday and Sunday (UTC) left out. */
export function workingMs(from: Date, to: Date): number {
  if (to <= from) return 0;
  let total = 0;
  let cursor = from.getTime();
  const end = to.getTime();
  while (cursor < end) {
    const dayEnd = Math.min(end, Math.floor(cursor / DAY_MS) * DAY_MS + DAY_MS);
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) total += dayEnd - cursor;
    cursor = dayEnd;
  }
  return total;
}

/** Whole working days between two instants: Friday noon to Monday noon is 1. */
export const workingDays = (from: Date, to: Date): number => Math.floor(workingMs(from, to) / DAY_MS);

/** How long a wait has lasted, in words: `today` under a working day, else `1 day`, `3 days`. */
export function ageWords(days: number): string {
  if (days < 1) return 'today';
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** Someone whose turn it is: a member or a login by their face, a team by its name. */
export type Turn = { kind: 'person'; person: Pick<Person, 'name' | 'face' | 'login'> } | { kind: 'team'; name: string };

/** One row of the board. */
export interface BoardRow {
  id: string;
  /** What it waits on, in words: `review`, `merge`, `approval`, `outbox · 2 questions`, `law`. */
  what: string;
  kind: WaitKind;
  /** The PRD, with its page; null for a bug fix or a visual update. */
  prd: { number: number; title: string | null; href: string | null } | null;
  /** The pull request, on GitHub; null for an `approval`. */
  pr: { number: number; repo: string; href: string } | null;
  repo: string;
  turn: Turn[];
  /** Said when nobody is named: `any approver`, `anyone who can merge`. */
  anyone: string | null;
  days: number;
  age: string;
  overdue: boolean;
}

/** The board: its rows, oldest first, and the tracked repositories named stale. */
export interface BoardValue {
  rows: BoardRow[];
  stale: string[];
  /** How many open waits name the viewer by login (never by a team): the My reviews tab's count. */
  reviews: number;
}

/** The tabs, in order. */
export type TabId = 'workspace' | 'mine' | 'reviews';
export const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'workspace', label: 'Workspace' }, { id: 'mine', label: 'My PRDs' }, { id: 'reviews', label: 'My reviews' },
];

/** The tab a query asks for: Workspace, whatever it says. */
export const tabOf = (value: string | null | undefined): TabId => TABS.find((t) => t.id === value)?.id ?? 'workspace';

/** A query parameter's first value, or null. */
export const firstOf = (value: string | string[] | undefined): string | null => (Array.isArray(value) ? value[0] : value) ?? null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What a wait is waiting on, in words. */
export function whatWords(kind: WaitKind, questions: number): string {
  return kind === 'outbox' && questions > 0 ? `outbox · ${plural(questions, 'question', 'questions')}` : kind;
}

const isTeam = (name: string) => name.includes('/');

function turnOf(logins: readonly string[], people: People): Turn[] {
  return logins.map((login): Turn => (isTeam(login) ? { kind: 'team', name: login } : { kind: 'person', person: people.byLogin(login) }));
}

/** The pull request's address on GitHub. */
const pullHref = (repo: string, pr: PrNumber): string => `https://github.com/${repo}/pull/${pr}`;

/** The page of a PRD's dossier. */
const prdHref = (dossier: string): string => `/prd/${encodeURIComponent(dossier)}`;

/** Oldest first; a tie by repository then number, so the order is the same at every render. */
function byAge([sinceA, a]: [number, BoardRow], [sinceB, b]: [number, BoardRow]): number {
  return sinceA - sinceB || a.repo.localeCompare(b.repo) || (a.pr?.number ?? 0) - (b.pr?.number ?? 0) || a.id.localeCompare(b.id);
}

/** The anyone-turn words of a wait that names nobody. */
const anyoneOf = (wait: StoredWait): string | null => (wait.turn.length > 0 ? null : wait.kind === 'merge' ? 'anyone who can merge' : 'any approver');

/** The PRD a wait names, with its page when the workspace has one. */
function prdOf(wait: StoredWait, dossiers: ReadonlyMap<string, PrdPage>): BoardRow['prd'] {
  if (wait.prd === null) return null;
  const page = dossiers.get(prdKey(wait.repo, wait.prd));
  return { number: wait.prd, title: page?.title ?? null, href: page ? prdHref(page.id) : null };
}

/** One wait as a row, with its start in ms for the order. */
function rowOf(wait: StoredWait, input: BoardInput, people: People): [number, BoardRow] {
  const since = new Date(wait.since);
  const worked = workingMs(since, input.now);
  const days = Math.floor(worked / DAY_MS);
  const questions = wait.prd === null ? 0 : (input.questions.get(prdKey(wait.repo, wait.prd)) ?? 0);
  const row: BoardRow = {
    id: wait.id,
    what: whatWords(wait.kind, questions),
    kind: wait.kind,
    prd: prdOf(wait, input.dossiers),
    pr: wait.pr === null ? null : { number: wait.pr, repo: wait.repo, href: pullHref(wait.repo, wait.pr) },
    repo: wait.repo,
    turn: turnOf(wait.turn, people),
    anyone: anyoneOf(wait),
    days,
    age: ageWords(days),
    overdue: worked > ESCALATION_WORKING_DAYS * DAY_MS,
  };
  return [since.getTime(), row];
}

/** Whether a wait's turn names this login: a team (`org/team`) never does, case ignored. */
export const turnIsLogin = (turn: readonly string[], login: string | null): boolean =>
  login !== null && turn.some((name) => !isTeam(name) && name.toLowerCase() === login.toLowerCase());

/** The waits a tab shows. Workspace: all. My PRDs: those of the PRDs whose dossier the viewer opened,
 * never a bug fix or a visual update (no PRD). My reviews: those whose turn names the viewer's login. */
function tabWaits(input: BoardInput): StoredWait[] {
  const { waits, dossiers, viewer, tab } = input;
  if (tab === 'workspace') return [...waits];
  if (tab === 'reviews') return waits.filter((w) => turnIsLogin(w.turn, viewer.login));
  return waits.filter((w) => w.prd !== null && dossiers.get(prdKey(w.repo, w.prd))?.owner === viewer.id);
}

/** The tab's board: its waits, oldest first (on My PRDs, those whose turn is the viewer's first). */
export function boardOf(input: BoardInput, people: People): BoardValue {
  const mineFirst = (wait: StoredWait) => (input.tab === 'mine' && turnIsLogin(wait.turn, input.viewer.login) ? 0 : 1);
  const rows = tabWaits(input)
    .map((wait): [number, [number, BoardRow]] => [mineFirst(wait), rowOf(wait, input, people)])
    .sort(([a, rowA], [b, rowB]) => a - b || byAge(rowA, rowB));
  return {
    rows: rows.map(([, [, row]]) => row),
    stale: staleRepositories(input.synced, input.now),
    reviews: input.waits.filter((w) => turnIsLogin(w.turn, input.viewer.login)).length,
  };
}

/** The tracked repositories the sync last read more than STALE_AFTER_MS ago, or never, by name. */
export function staleRepositories(synced: ReadonlyMap<string, string | null>, now: Date): string[] {
  return [...synced]
    .filter(([, at]) => at === null || now.getTime() - Date.parse(at) > STALE_AFTER_MS)
    .map(([repo]) => repo)
    .sort((a, b) => a.localeCompare(b));
}

/** The stale line, or null when every repository was read in time. */
export function staleLine(stale: readonly string[]): string | null {
  const [first, ...rest] = stale;
  if (first === undefined) return null;
  if (rest.length === 0) return `${first} was last synced more than 30 minutes ago, so its waits may be out of date.`;
  const last = rest[rest.length - 1];
  return `${[first, ...rest.slice(0, -1)].join(', ')} and ${last} were last synced more than 30 minutes ago, so their waits may be out of date.`;
}

const EMPTY_WORKSPACE = 'Nothing waits on a person.';
const EMPTY_MINE = 'None of your PRDs waits on anyone.';
const EMPTY_REVIEWS = 'Nothing waits on you.';

/** What a tab says when it has no row. */
export const EMPTY_BY_TAB: Readonly<Record<TabId, string>> = { workspace: EMPTY_WORKSPACE, mine: EMPTY_MINE, reviews: EMPTY_REVIEWS };
export const UNREADABLE_BOARD = 'The waiting board could not load. Reload in a moment.';
