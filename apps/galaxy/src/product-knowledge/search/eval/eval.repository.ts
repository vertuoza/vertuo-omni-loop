import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseRows } from '../../../data/parse-rows';
import type { EvalAnswer, EvalQuestion, EvalRun } from './eval-stats';

// The Eval view's storage (PRD omni-loop-8 s5; ADR-0095), on the client it is given, the signed-in person's, so
// row-level security decides what it returns: a member reads their workspace's set, answers and runs, a member of
// another workspace none. No rule lives here. A row holds a question's text and entry ids, never a key (L-GDPR-2).

const Measures = z.object({ questions: z.number(), top1: z.number(), top5: z.number(), recall5: z.number(), recall10: z.number(), mrr: z.number() });
const StoredMiss = z.object({ id: z.string().optional(), category: z.string(), rank: z.number().nullable(), first: z.array(z.string()), right: z.array(z.string()) });
const StoredRun = z.object({
  id: z.string(), trigger: z.string(), ran_at: z.string(),
  measures: z.object({ overall: Measures, categories: z.record(z.string(), Measures), misses: z.array(StoredMiss), skipped: z.number() }),
});
const StoredQuestion = z.object({ id: z.string(), question: z.string(), category: z.string().nullable(), added_by: z.string(), added_at: z.string() });
const StoredAnswer = z.object({
  question_id: z.string(), entry_id: z.string(), relevant: z.boolean(), source: z.enum(['jev', 'person']),
  confidence: z.number().nullable(), decided_by: z.string().nullable(), decided_at: z.string(),
});

/** The tables answer a thousand rows at most per read: the set and its answers are read in one. */
const MOST_ROWS = 1000;
/** The runs the chart draws: the latest ones. */
const MOST_RUNS = 120;

const RUN_COLUMNS = 'id, trigger, ran_at, measures';
const QUESTION_COLUMNS = 'id, question, category, added_by, added_at';
const ANSWER_COLUMNS = 'question_id, entry_id, relevant, source, confidence, decided_by, decided_at';

type Db = Pick<SupabaseClient, 'from'>;

/** A read's rows, parsed; null on a refusal or a row out of shape. */
async function rowsOf<T>(schema: z.ZodType<T>, read: PromiseLike<{ data: unknown; error: unknown }>, where: string): Promise<T[] | null> {
  const { data, error } = await read;
  if (error) return null;
  const parsed = parseRows(schema, data, where);
  return parsed.ok ? parsed.value : null;
}

/** The latest runs of `product`, oldest first; null when they cannot be read. */
export async function runsOf(db: Db, product: string): Promise<EvalRun[] | null> {
  const rows = await rowsOf(StoredRun, db.from('search_eval_runs').select(RUN_COLUMNS).eq('product_id', product)
    .order('ran_at', { ascending: false }).limit(MOST_RUNS), 'product-knowledge/eval.repository: search_eval_runs');
  return rows?.map((r) => ({
    id: r.id, ranAt: r.ran_at, trigger: r.trigger, overall: r.measures.overall, categories: r.measures.categories,
    misses: r.measures.misses.map(({ id, ...rest }) => (id === undefined ? rest : { id, ...rest })), skipped: r.measures.skipped,
  })).reverse() ?? null;
}

/** The questions of `product` a member has not removed, oldest first. */
export async function questionsOf(db: Db, product: string): Promise<EvalQuestion[] | null> {
  const rows = await rowsOf(StoredQuestion, db.from('search_eval_questions').select(QUESTION_COLUMNS)
    .eq('product_id', product).is('removed_at', null).order('added_at', { ascending: true }).limit(MOST_ROWS), 'product-knowledge/eval.repository: search_eval_questions');
  return rows?.map((r) => ({ id: r.id, question: r.question, category: r.category, addedBy: r.added_by, addedAt: r.added_at })) ?? null;
}

/** The answers of the workspace (the caller keeps those of its product's questions). */
export async function answersOf(db: Db): Promise<EvalAnswer[] | null> {
  const rows = await rowsOf(StoredAnswer, db.from('search_eval_answers').select(ANSWER_COLUMNS)
    .order('decided_at', { ascending: true }).limit(MOST_ROWS), 'product-knowledge/eval.repository: search_eval_answers');
  return rows?.map((r) => ({
    questionId: r.question_id, entryId: r.entry_id, relevant: r.relevant, source: r.source, confidence: r.confidence,
    decidedBy: r.decided_by, decidedAt: r.decided_at,
  })) ?? null;
}

/** This module's three reads as `pnpm schemas:verify` runs them, a few rows each, with their schemas (eval.boundary.ts). */
export const boundaryReads = [
  { name: 'product-knowledge/eval.repository: search_eval_runs', read: (db: Db) => db.from('search_eval_runs').select(RUN_COLUMNS).limit(5), schema: StoredRun },
  { name: 'product-knowledge/eval.repository: search_eval_questions', read: (db: Db) => db.from('search_eval_questions').select(QUESTION_COLUMNS).limit(5), schema: StoredQuestion },
  { name: 'product-knowledge/eval.repository: search_eval_answers', read: (db: Db) => db.from('search_eval_answers').select(ANSWER_COLUMNS).limit(5), schema: StoredAnswer },
] as const;
