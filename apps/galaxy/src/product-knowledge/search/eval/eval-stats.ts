import type { Measures, Miss } from 'omni-loop/kit/lib/knowledge/search-eval.ts';
import type { Query } from '../../../nav/query';

// The Eval view's numbers (PRD omni-loop-8 s5), pure: a run as the search-eval-run job keeps it, the series of
// one measure over the runs, the set of questions with their right answers. No clock, no store.

export type { Measures, Miss };

/** One run of the eval set, as stored: when, why, and its measures overall and per category. */
export interface EvalRun {
  id: string;
  ranAt: string;
  trigger: string;
  overall: Measures;
  categories: Readonly<Record<string, Measures>>;
  misses: readonly Miss[];
  skipped: number;
}

/** A question of the set: its category and who added it (`promotion`, or a member's login). */
export interface EvalQuestion {
  id: string;
  question: string;
  category: string | null;
  addedBy: string;
  addedAt: string;
}

/** An entry's verdict for a question: Jev's or a person's, a person's always winning. */
export interface EvalAnswer {
  questionId: string;
  entryId: string;
  relevant: boolean;
  source: 'jev' | 'person';
  confidence: number | null;
  decidedBy: string | null;
  decidedAt: string;
}

export interface SetQuestion {
  question: EvalQuestion;
  /** The entries that answer it, a person's first. */
  right: EvalAnswer[];
  /** The entries a person said do not answer it: kept, so a later judgement leaves them out. */
  refused: EvalAnswer[];
}

/** The four measures drawn over time, in the order of the legend. */
export const SERIES = [
  { key: 'top1', label: 'top@1' },
  { key: 'top5', label: 'top@5' },
  { key: 'recall5', label: 'recall@5' },
  { key: 'recall10', label: 'recall@10' },
] as const;

/** What a write answers: kept, or refused with the one line the control shows. */
export type EvalWrite = { ok: true } | { ok: false; message: string };

export const NO_RUN = 'No run yet: the set runs once a day and after new knowledge is embedded. The set is below.';
export const NO_QUESTION = 'The set holds no question yet. Add one below, or wait for the daily promotion of each category’s most-asked ones.';

/** Every category some run measured, in the order they first appear, oldest run first. */
export function categoriesOfRuns(runs: readonly EvalRun[]): string[] {
  return [...new Set(runs.flatMap((run) => Object.keys(run.categories)))];
}

/** The category a `?category=` names when a run holds it, else null (the overall measures). */
export function openCategoryOf(runs: readonly EvalRun[], query: Query): string | null {
  const raw = Array.isArray(query.category) ? query.category[0] : query.category;
  return raw !== undefined && categoriesOfRuns(runs).includes(raw) ? raw : null;
}

/** The measures of each run, oldest first, overall or of one category (a run without it leaves a gap, not a zero). */
export function seriesOf(runs: readonly EvalRun[], category: string | null): { at: string; measures: Measures }[] {
  return runs.flatMap((run) => {
    const measures = category === null ? run.overall : run.categories[category];
    return measures === undefined ? [] : [{ at: run.ranAt, measures }];
  });
}

/** The set: each question with its right answers (a person's first, then Jev's by confidence) and the entries refused. */
export function setOf(questions: readonly EvalQuestion[], answers: readonly EvalAnswer[]): SetQuestion[] {
  const order = (a: EvalAnswer, b: EvalAnswer): number =>
    Number(b.source === 'person') - Number(a.source === 'person') || (b.confidence ?? 0) - (a.confidence ?? 0) || a.entryId.localeCompare(b.entryId);
  return questions.map((question) => {
    const mine = answers.filter((a) => a.questionId === question.id).sort(order);
    return { question, right: mine.filter((a) => a.relevant), refused: mine.filter((a) => !a.relevant) };
  });
}

/** Who gave an answer, as the page says it. */
export const byOf = (answer: Pick<EvalAnswer, 'source' | 'decidedBy'>): string =>
  answer.source === 'person' ? `person${answer.decidedBy === null ? '' : ` @${answer.decidedBy}`}` : 'Jev';

/** Who added a question. */
export const addedByOf = (question: Pick<EvalQuestion, 'addedBy'>): string => (question.addedBy === 'promotion' ? 'promotion' : `@${question.addedBy}`);

/** A miss's question text, from the set when its id is still there. */
export function missTextOf(miss: Miss, questions: readonly EvalQuestion[]): string | null {
  return questions.find((q) => q.id === miss.id)?.question ?? null;
}
