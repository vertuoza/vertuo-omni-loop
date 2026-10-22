import { drawerKey } from '../../nav/drawer';
import type { IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import { positionOf } from 'omni-loop/kit/lib/narrow.ts';
import { roundAnswers, type AskQuestion, type Draft } from '../../ask/answer-model';
import type { Called } from '../runners.client';
import { ANSWER_CHARS, type JobQuestions, type Question } from '../runners.contract';

// The Need human drawer's rules (PRD 2255 s3, the `runner-need-human` screen), pure or driven through seams,
// so each is tested without a browser: which job `?answer=` opens and the URL it sets, a job's questions and
// answers in the shape the Questions page's model takes, the words of a closed row and of a read that failed,
// where the focus goes, what Tab does inside the drawer, and the demo's port, which holds its rows in memory.

/** The URL parameter that names the job whose drawer is open. */
const ANSWER_PARAM = 'answer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The job `?answer=` names, or null when it names none, or not a job id. */
export const answerParamOf = (value: string | null | undefined): string | null => (value && UUID.test(value) ? value : null);

/** The job `?answer=` opens: the one it names, when the board lists it (a job of another workspace never is). */
export const listedAnswer = (value: string | null | undefined, jobs: readonly { id: string }[]): string | null => {
  const job = answerParamOf(value);
  return job !== null && jobs.some((listed) => listed.id === job) ? job : null;
};

/** `href` with `?answer=<job>` set, or removed when `job` is null; every other parameter and the hash kept. */
export function withAnswer(href: string, job: string | null): string {
  const url = new URL(href);
  if (job === null) url.searchParams.delete(ANSWER_PARAM);
  else url.searchParams.set(ANSWER_PARAM, job);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The issue a job worked on, on GitHub: the header's link. */
export const issueUrl = (repo: string, issue: IssueNumber): string => `https://github.com/${repo}/issues/${String(issue)}`;

export const WORDS = {
  need: 'Need human',
  send: 'Send answers',
  sending: 'Sending…',
  dismiss: 'Dismiss',
  close: 'Close',
  own: 'Or your own answer',
  loading: 'Reading the questions…',
} as const;

/** A job's questions as the Questions page's model takes them: an option has no preview. */
export const questionsOf = (questions: readonly Question[]): AskQuestion[] =>
  questions.map((question) => ({
    question: question.question,
    header: question.header,
    multiSelect: question.multiSelect,
    options: question.options.map((option) => ({ label: option.label, description: option.description, preview: null })),
  }));

/** The answers to send, each question's text to its answer; null until every question has one, and while one is
 * past what the route takes (Send answers stays off). */
export function answersOf(questions: readonly AskQuestion[], draft: Draft): Record<string, string> | null {
  const answers = roundAnswers([...questions], draft);
  return answers === null || Object.values(answers).some((answer) => answer.length > ANSWER_CHARS) ? null : answers;
}

/** Who closed a row, in words: an API key by its name (PRD 2425), then ` · for <acting_for>` when the app said whom it acted for,
 * as given; else the person's login; else someone. A key's close never reads as a person's. */
function closerWords(row: Pick<JobQuestions, 'byLogin' | 'byKey' | 'actingFor'>): string {
  if (row.byKey) return row.actingFor ? `API key ${row.byKey} · for ${row.actingFor}` : `API key ${row.byKey}`;
  return row.byLogin === null ? 'someone' : `@${row.byLogin}`;
}

/** Why a closed row refuses another answer, in the service's words: who answered, or dismissed, it. Null while open. */
export function closedWords(row: Pick<JobQuestions, 'state' | 'answers' | 'byLogin' | 'byKey' | 'actingFor'>): string | null {
  if (row.state === 'open') return null;
  return `${row.state === 'dismissed' ? 'Dismissed' : 'Already answered'} by ${closerWords(row)}`;
}

const CLOSED_REFUSAL = /^(Already answered|Dismissed) by .+$/;

/** A refusal that says someone came first (the answer or the dismissal), as the drawer shows a closed row; null for any other. */
export const refusedAsClosed = (words: string): string | null => (CLOSED_REFUSAL.test(words) ? words : null);

/** What the routes say of a job nobody sees, or one that asked no question (runners.service.ts): the drawer does not open. */
const NOT_FOUND: readonly string[] = ['No such job.', 'This job asked no question.'];

/** What the drawer holds of a job's questions: not read yet, open to answer, closed by someone, not there, or a read that failed. */
export type Reading =
  | { kind: 'loading' }
  | { kind: 'open'; row: JobQuestions; asked: AskQuestion[] }
  | { kind: 'closed'; words: string; issue: IssueNumber | null }
  | { kind: 'missing' }
  | { kind: 'failed'; words: string };

export const LOADING: Reading = { kind: 'loading' };

/** A read of a job's questions, as the drawer shows it. */
export function readingOf(called: Called<JobQuestions>): Reading {
  if (!called.ok) return NOT_FOUND.includes(called.error) ? { kind: 'missing' } : { kind: 'failed', words: called.error };
  const words = closedWords(called.value);
  return words === null ? { kind: 'open', row: called.value, asked: questionsOf(called.value.questions) } : { kind: 'closed', words, issue: called.value.issue };
}

/** What the drawer shows after a send refused because someone came first: the row read again, which names an API key by its
 * name (the refusal's own words know a login only), else the refusal's words, when the row cannot be read or reads open still. */
export function closedAfter(words: string, again: Called<JobQuestions>, issue: IssueNumber | null): Extract<Reading, { kind: 'closed' }> {
  const next = readingOf(again);
  return next.kind === 'closed' ? next : { kind: 'closed', words, issue };
}

/** Which drawer is open, and where the focus goes: into the drawer once it opened, back to the job's button once
 * it closed (Escape, the close button, the dimmed page, or a send), nowhere before either. */
export type AnswerState = { open: string | null; focus: 'drawer' | 'button' | 'none'; job: string | null };

export const NONE: AnswerState = { open: null, focus: 'none', job: null };

export const opened = (job: string): AnswerState => ({ open: job, focus: 'drawer', job });

export const closed = (state: AnswerState): AnswerState => (state.open === null ? state : { open: null, focus: 'button', job: state.open });

/** What a key inside the open drawer does: close it, move the focus to one of its `items`, or nothing (the
 * browser's own). `active` is what holds the focus now; anything that is not one of the items counts as outside. */
export type Move<T> = { kind: 'close' } | { kind: 'focus'; item: T } | { kind: 'none' };

export function drawerMove<T>(key: string, shift: boolean, items: readonly T[], active: unknown): Move<T> {
  const move = drawerKey(key, shift, positionOf(items, active), items.length);
  if (move.kind !== 'focus') return move;
  const item = items[move.index];
  return item === undefined ? { kind: 'none' } : { kind: 'focus', item };
}

/** The drawer's reads and writes: the routes' (runners.client.ts), or the demo's own. A write answers its value or the
 * route's words for why not. */
export interface NeedHumanPort {
  read(job: string): Promise<Called<JobQuestions>>;
  answer(job: string, answers: Record<string, string>): Promise<Called<unknown>>;
  dismiss(job: string): Promise<Called<JobQuestions>>;
}

/** The demo's port: the rows it was given, answered or dismissed in memory by `login`, so the drawer plays in the
 * browser with no route to call. The first answer wins, as on the server; `resume` stands for the job it queues. */
export function demoPort(rows: readonly JobQuestions[], login: string, resume: { id: string }): NeedHumanPort {
  const held = new Map<string, JobQuestions>(rows.map((row) => [row.job, row] as const));
  const missing = <T>(): Called<T> => ({ ok: false, error: 'This job asked no question.' });
  const refused = <T>(row: JobQuestions): Called<T> => ({ ok: false, error: closedWords(row) ?? '' });
  const close = (row: JobQuestions, over: Partial<JobQuestions>): JobQuestions => {
    const next = { ...row, byLogin: login, ...over };
    held.set(row.job, next);
    return next;
  };
  return {
    read: (job) => {
      const row = held.get(job);
      return Promise.resolve(row ? { ok: true, value: row } : missing());
    },
    answer: (job, answers) => {
      const row = held.get(job);
      if (!row) return Promise.resolve(missing());
      if (row.state !== 'open') return Promise.resolve(refused(row));
      close(row, { state: 'answered', answers, resume: resume.id });
      return Promise.resolve({ ok: true, value: resume });
    },
    dismiss: (job) => {
      const row = held.get(job);
      if (!row) return Promise.resolve(missing());
      if (row.state !== 'open') return Promise.resolve(refused(row));
      return Promise.resolve({ ok: true, value: close(row, { state: 'dismissed' }) });
    },
  };
}
