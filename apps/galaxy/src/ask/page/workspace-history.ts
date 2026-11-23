// The workspace's history (PRD 144): every round of the caller's workspaces, newest first, filtered
// by category, repo, PRD, skill, who asked and who answered, and searched by the words of a question
// or its answer. Pure functions of the rows the caller may read (row-level security already left out
// every other workspace), the workspaces' members and the filters in the address. Each row opens
// /ask/q/<round>.
// Since PRD omni-loop-23 (ADR-0171) the database pages and counts the history (ask_history_page and
// ask_history_facets): the Done tab draws one page of 50 and the counts it is given. The same reads,
// done here over rows in memory, serve the demo (historyPageOf, historyFacetsOf).
import { readQuestions } from '../answer-model';
import { CATEGORIES, CATEGORY_LABELS, isCategory, type Category } from '../classify';
import { one, type Query } from '../../nav/query';
import type { Face } from '../../people/face';
import { faceOfMember, nameOf, type Member } from './question';
import { contextParts, entry, type RoundRow, type SessionRow } from './view';
import { type PrdNumber, PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';

/** A round and its session, as the history reads them. */
export type HistoryRow = { round: RoundRow; session: SessionRow };

/** What the history is narrowed to: each filter left out lets every round through. */
export type HistoryFilters = {
  category?: Category | 'unsorted';
  repo?: string;
  prd?: PrdNumber;
  skill?: string;
  askedBy?: string;
  answeredBy?: string;
  /** Words, each of which must appear in the round's questions or answers. */
  search?: string;
  /** Not a filter: the page's cursor, the id of the last round the page before showed (`?before=`). */
  before?: string;
};

/** How many rounds one page of the history holds (PRD omni-loop-23). */
export const HISTORY_PAGE = 50;

export type HistoryItem = {
  roundId: string;
  href: string;
  /** The first question's text, and how many more the round asked. */
  question: string;
  more: number;
  /** The answers, joined; null while nothing is answered. */
  answer: string | null;
  /** How many screenshots the answers carry, all together (PRD 620). */
  screenshots: number;
  status: RoundRow['status'];
  via: RoundRow['answered_via'];
  askedBy: string;
  answeredBy: string | null;
  /** Their faces (PRD 652), drawn before each name. */
  askedByFace: Face;
  answeredByFace: Face | null;
  /** The category's label, or "unsorted". */
  category: string;
  at: string;
  context: string[];
};

/** A cursor as an address carries it: a round's id, never more than an id's characters. */
const CURSOR = /^[\w-]{1,64}$/;

/** The filters an address carries: `category`, `repo`, `prd`, `skill`, `asked`, `answered`, `q`, and
 * the page's cursor, `before`. */
export function readHistoryFilters(query: Query): HistoryFilters {
  const filters: HistoryFilters = {};
  const category = one(query.category);
  if (category === 'unsorted' || isCategory(category)) filters.category = category;
  const repo = one(query.repo);
  if (repo) filters.repo = repo;
  const prd = PrdNumberSchema.safeParse(Number(one(query.prd)));
  if (prd.success) filters.prd = prd.data;
  const skill = one(query.skill);
  if (skill) filters.skill = skill;
  const asked = one(query.asked);
  if (asked) filters.askedBy = asked;
  const answered = one(query.answered);
  if (answered) filters.answeredBy = answered;
  const search = one(query.q);
  if (search) filters.search = search;
  const before = one(query.before);
  if (before && CURSOR.test(before)) filters.before = before;
  return filters;
}

/** The filters without the page's cursor: what the history is narrowed to. */
export function narrowing(filters: HistoryFilters): HistoryFilters {
  const narrow = { ...filters };
  delete narrow.before;
  return narrow;
}

/** Everything a search looks through: each question, its header, and every answer. */
function words(round: RoundRow): string {
  const questions = readQuestions(round.questions).flatMap((q) => [q.header, q.question]);
  return [...questions, ...Object.values(round.answers ?? {})].join('\n').toLowerCase();
}

function passes({ round, session }: HistoryRow, filters: HistoryFilters): boolean {
  const category = isCategory(round.category) ? round.category : 'unsorted';
  if (filters.category && filters.category !== category) return false;
  if (filters.repo && session.repo !== filters.repo) return false;
  if (filters.prd && round.prd !== filters.prd) return false;
  if (filters.skill && round.skill !== filters.skill) return false;
  if (filters.askedBy && session.owner !== filters.askedBy) return false;
  if (filters.answeredBy && round.answered_by !== filters.answeredBy) return false;
  if (filters.search) {
    const text = words(round);
    if (!filters.search.toLowerCase().split(/\s+/).every((word) => text.includes(word))) return false;
  }
  return true;
}

const newestFirst = (a: HistoryRow, b: HistoryRow) =>
  Date.parse(b.round.created_at) - Date.parse(a.round.created_at) || b.round.id.localeCompare(a.round.id);

/** The rounds the filters let through, newest first, as the history lists them. */
export function historyList(rows: HistoryRow[], filters: HistoryFilters, members: Member[]): HistoryItem[] {
  return historyItemsOf(rows.filter((row) => passes(row, filters)).sort(newestFirst), members);
}

/** Each row as the history lists it, in the order given: a page the database already narrowed and
 * ordered is drawn as it came. */
export function historyItemsOf(rows: HistoryRow[], members: Member[]): HistoryItem[] {
  return rows.map(({ round, session }) => {
    const { lines } = entry(round, session);
    const answers = lines.map((line) => line.answer).filter((a): a is string => a !== null);
    const category = isCategory(round.category) ? CATEGORY_LABELS[round.category] : 'unsorted';
    const askedBy = nameOf(session.owner, members);
    const answeredBy = round.answered_by ? nameOf(round.answered_by, members) : null;
    return {
      roundId: round.id,
      href: `/ask/q/${encodeURIComponent(round.id)}`,
      question: lines[0]?.question ?? 'A question',
      more: Math.max(0, readQuestions(round.questions).length - 1),
      answer: answers.length > 0 ? answers.join(' · ') : null,
      screenshots: lines.reduce((sum, line) => sum + (line.screenshots ?? 0), 0),
      status: round.status,
      via: round.answered_via,
      askedBy,
      answeredBy,
      askedByFace: faceOfMember(session.owner, members, askedBy),
      answeredByFace: answeredBy === null ? null : faceOfMember(round.answered_by, members, answeredBy),
      category,
      at: round.created_at,
      context: contextParts(session, round),
    };
  });
}

export type Choice = { id: string; label: string };

/** What each filter offers: the values the rows hold, once each. */
export type HistoryChoices = { repos: string[]; prds: number[]; skills: string[]; askedBy: Choice[]; answeredBy: Choice[] };

const distinct = <T>(values: Array<T | null | undefined>) => [...new Set(values.filter((v): v is T => v !== null && v !== undefined))];

const people = (ids: string[], members: Member[]): Choice[] =>
  ids.map((id) => ({ id, label: nameOf(id, members) })).sort((a, b) => a.label.localeCompare(b.label));

/** What each filter offers: the values the rows hold, and the one chosen, so a page that holds none of
 * it still offers it back. */
export function historyChoices(rows: HistoryRow[], members: Member[], chosen: HistoryFilters = {}): HistoryChoices {
  return {
    repos: distinct([...rows.map((r) => r.session.repo), chosen.repo]).sort(),
    prds: distinct([...rows.map((r) => r.round.prd), chosen.prd]).sort((a, b) => a - b),
    skills: distinct([...rows.map((r) => r.round.skill), chosen.skill]).sort(),
    askedBy: people(distinct([...rows.map((r) => r.session.owner), chosen.askedBy]), members),
    answeredBy: people(distinct([...rows.map((r) => r.round.answered_by), chosen.answeredBy]), members),
  };
}

/** Whether any filter is set: the page then offers to clear them. The cursor is no filter. */
export const filtered = (filters: HistoryFilters) => Object.keys(narrowing(filters)).length > 0;

/** Whether a round is history: answered, or moved to the terminal. A waiting round is on Open. */
const done = ({ round }: HistoryRow) => round.status === 'answered' || round.status === 'abandoned';

/** One page of the history and the cursor of the next, or null when it is the last. */
export type HistoryPageRows = { rows: HistoryRow[]; next: string | null };

/** One page, as ask_history_page reads it, over rows in memory (the demo): the answered and moved rounds
 * the filters let through, newest first, after the round `filters.before` names; a cursor that names no
 * round gives an empty page. */
export function historyPageOf(rows: HistoryRow[], filters: HistoryFilters, size = HISTORY_PAGE): HistoryPageRows {
  const listed = rows.filter((row) => done(row) && passes(row, filters)).sort(newestFirst);
  const cursor = filters.before === undefined ? null : rows.find((row) => row.round.id === filters.before);
  if (cursor === undefined) return { rows: [], next: null };
  const after = cursor === null ? listed : listed.filter((row) => newestFirst(cursor, row) < 0);
  const page = after.slice(0, size);
  return { rows: page, next: after.length > size ? page.at(-1)?.round.id ?? null : null };
}

/** Where the history lives since PRD omni-loop-22: the Inbox's Done tab. */
export const DONE_PATH = '/app/inbox/done';

/** One line of the Done tab's sidebar (visual update #3169): a category, its label and how many rows
 * it holds under the other filters. `id` is the category, or `unsorted`. */
export type CategoryCount = { id: Category | 'unsorted'; label: string; count: number };

/** The categories in the sidebar's order, unsorted last. */
const ORDER: Array<Category | 'unsorted'> = [...CATEGORIES, 'unsorted'];

const labelOf = (id: Category | 'unsorted') => (id === 'unsorted' ? 'Unsorted' : CATEGORY_LABELS[id]);

const categoryOf = ({ round }: HistoryRow): Category | 'unsorted' => (isCategory(round.category) ? round.category : 'unsorted');

/** How many of the rows each category holds under every filter but the category itself. */
function countBy(rows: HistoryRow[], filters: HistoryFilters): Map<string, number> {
  const others = narrowing(filters);
  delete others.category;
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!passes(row, others)) continue;
    const id = categoryOf(row);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The categories the rows hold under every filter but the category itself, in the categories'
 * order, unsorted last; a category with no row is left out. */
export function categoryCounts(rows: HistoryRow[], filters: HistoryFilters): CategoryCount[] {
  const counts = countBy(rows, filters);
  return ORDER.filter((id) => (counts.get(id) ?? 0) > 0).map((id) => ({ id, label: labelOf(id), count: counts.get(id) ?? 0 }));
}

/** One category of the history, as ask_history_facets counts it: `matched`, its rounds under every
 * filter but the category; `total`, its rounds under none. */
export type HistoryFacet = { id: Category | 'unsorted'; matched: number; total: number };

/** The counts, as ask_history_facets reads them, over rows in memory (the demo): every category,
 * unsorted last, zeros kept, over the answered and moved rounds. */
export function historyFacetsOf(rows: HistoryRow[], filters: HistoryFilters): HistoryFacet[] {
  const history = rows.filter(done);
  const matched = countBy(history, filters);
  const total = countBy(history, {});
  return ORDER.map((id) => ({ id, matched: matched.get(id) ?? 0, total: total.get(id) ?? 0 }));
}

/** A category's counts as the database answers them: a bigint may come as text. */
export type RawFacet = { category: string; matched: number | string; total: number | string };

/** The counts as the database answers them, read: a category it does not know is left out, and a
 * category it left out counts none, so the sidebar always holds every one. */
export function readFacets(raw: readonly RawFacet[]): HistoryFacet[] {
  const known = new Map(raw.map((r) => [r.category, r]));
  return ORDER.map((id) => {
    const found = known.get(id);
    return { id, matched: Number(found?.matched ?? 0), total: Number(found?.total ?? 0) };
  });
}

/** The sidebar's lines: each category's count under the other filters, a category with none kept. */
export const categoriesOf = (facets: HistoryFacet[]): CategoryCount[] =>
  facets.map(({ id, matched }) => ({ id, label: labelOf(id), count: matched }));

/** How many rounds the history holds before any filter: the true total, never capped. */
export const historyTotal = (facets: HistoryFacet[]) => facets.reduce((sum, f) => sum + f.total, 0);

/** How many rounds every filter lets through, the category's included. */
export const historyMatched = (facets: HistoryFacet[], filters: HistoryFilters) =>
  facets.filter((f) => !filters.category || f.id === filters.category).reduce((sum, f) => sum + f.matched, 0);

const PARAMS: Array<[keyof HistoryFilters, string]> = [
  ['search', 'q'], ['category', 'category'], ['repo', 'repo'], ['prd', 'prd'], ['skill', 'skill'], ['askedBy', 'asked'], ['answeredBy', 'answered'], ['before', 'before'],
];

/** The Done tab's address for these filters with `patch` laid over them; a key patched to undefined is
 * dropped. The cursor is kept only when the patch names it: any other change starts from the newest. */
export function historyHref(filters: HistoryFilters, patch: { [K in keyof HistoryFilters]?: HistoryFilters[K] | undefined }): string {
  const merged: { [K in keyof HistoryFilters]?: HistoryFilters[K] | undefined } = { ...narrowing(filters), ...patch };
  const params = new URLSearchParams();
  for (const [key, name] of PARAMS) {
    const value = merged[key];
    if (value !== undefined && value !== '') params.set(name, String(value));
  }
  const query = params.toString();
  return query ? `${DONE_PATH}?${query}` : DONE_PATH;
}
