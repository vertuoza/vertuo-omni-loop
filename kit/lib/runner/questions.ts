// What a runner job asks the person when its skill stops for a decision (PRD 2255, s2): the questions it
// writes in the file shape `omni ask question --file` reads (`../ask/schema.ts`), held to the limits the
// Omni app's route holds them to, and the line the skill posts on the issue once they are stored.
import { readQuestionFile } from '../ask/schema.ts';
import type { QuestionFile } from '../ask/schema.ts';

/** At most this many questions a job asks at once. */
export const MAX_QUESTIONS = 4;
/** Each question holds this many options at least: a choice has two sides. */
export const MIN_OPTIONS = 2;
/** Each question holds this many options at most, the last being the way out of the choice (Design it first). */
export const MAX_OPTIONS = 4;

/** The questions a job asks, as `omni ask question --file` reads them. */
export type JobQuestionList = QuestionFile['questions'];

/** What reading a file came to: the questions, or the first field it gets wrong, as a dotted path. */
export type JobQuestionsRead = { ok: true; value: JobQuestionList } | { ok: false; field: string; message: string };

/**
 * `value` read as the questions a job asks: `omni ask`'s file shape (a label and a description on each option,
 * an unknown field refused), 1 to `MAX_QUESTIONS` questions, each with a header and `MIN_OPTIONS` to
 * `MAX_OPTIONS` options. Anything else is the field it gets wrong, named as `omni ask` names one.
 */
export function readJobQuestions(value: unknown): JobQuestionsRead {
  const file = readQuestionFile(value);
  if (!file.ok) return file;
  const { questions } = file.value;
  if (questions.length > MAX_QUESTIONS) {
    return { ok: false, field: 'questions', message: `at most ${String(MAX_QUESTIONS)} questions, got ${String(questions.length)}` };
  }
  for (const [index, question] of questions.entries()) {
    if (question.header.trim() === '') return { ok: false, field: `questions.${String(index)}.header`, message: 'a header is needed' };
    if (question.options.length < MIN_OPTIONS || question.options.length > MAX_OPTIONS) {
      return {
        ok: false,
        field: `questions.${String(index)}.options`,
        message: `${String(MIN_OPTIONS)} to ${String(MAX_OPTIONS)} options, got ${String(question.options.length)}`,
      };
    }
  }
  return { ok: true, value: questions };
}

/** The Runners page, opened on the drawer of the job's questions (`?answer=<job>`). */
export function answerLink(askUrl: string, job: string): string {
  return `${askUrl.replace(/\/+$/, '')}/app/runners?${new URLSearchParams({ answer: job }).toString()}`;
}

/** The line a stopped skill ends its comment on once its questions are stored, and `omni runner ask` prints. */
export function waitingLine(askUrl: string, job: string): string {
  return `Waiting for an answer on Omni: ${answerLink(askUrl, job)}`;
}
