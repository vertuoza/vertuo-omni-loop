// The workspace's history (PRD 144): every round of the caller's workspaces, newest first, filtered
// by category, repo, PRD, skill, who asked and who answered, and searched by the words of a question
// or its answer. Pure functions of the rows the caller may read (row-level security already left out
// every other workspace), the workspaces' members and the filters in the address. Each row opens
// /ask/q/<round>.
import { readQuestions } from '../answer-model';
import { CATEGORY_LABELS, isCategory, type Category } from '../classify';
import type { Face } from '../../people/face';
import { faceOfMember, nameOf, type Member } from './question';
import { contextParts, entry, type RoundRow, type SessionRow } from './view';

/** A round and its session, as the history reads them. */
export type HistoryRow = { round: RoundRow; session: SessionRow };

/** What the history is narrowed to: each filter left out lets every round through. */
export type HistoryFilters = {
  category?: Category | 'unsorted';
  repo?: string;
  prd?: number;
  skill?: string;
  askedBy?: string;
  answeredBy?: string;
  /** Words, each of which must appear in the round's questions or answers. */
  search?: string;
};

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

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first ? first : undefined;
};

/** The filters an address carries: `category`, `repo`, `prd`, `skill`, `asked`, `answered`, `q`. */
export function readHistoryFilters(query: Query): HistoryFilters {
  const filters: HistoryFilters = {};
  const category = one(query.category);
  if (category === 'unsorted' || isCategory(category)) filters.category = category;
  const repo = one(query.repo);
  if (repo) filters.repo = repo;
  const prd = Number(one(query.prd));
  if (Number.isInteger(prd) && prd > 0) filters.prd = prd;
  const skill = one(query.skill);
  if (skill) filters.skill = skill;
  const asked = one(query.asked);
  if (asked) filters.askedBy = asked;
  const answered = one(query.answered);
  if (answered) filters.answeredBy = answered;
  const search = one(query.q);
  if (search) filters.search = search;
  return filters;
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
  return rows.filter((row) => passes(row, filters)).sort(newestFirst).map(({ round, session }) => {
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

export function historyChoices(rows: HistoryRow[], members: Member[]): HistoryChoices {
  return {
    repos: distinct(rows.map((r) => r.session.repo)).sort(),
    prds: distinct(rows.map((r) => r.round.prd)).sort((a, b) => a - b),
    skills: distinct(rows.map((r) => r.round.skill)).sort(),
    askedBy: people(distinct(rows.map((r) => r.session.owner)), members),
    answeredBy: people(distinct(rows.map((r) => r.round.answered_by)), members),
  };
}

/** Whether any filter is set: the page then offers to clear them. */
export const filtered = (filters: HistoryFilters) => Object.keys(filters).length > 0;
