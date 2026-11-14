import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvalWrite } from './eval-stats';

// The Eval view's writes (PRD omni-loop-8 s5; ADR-0095), on the client it is given, the signed-in person's: the
// member functions of supabase/migrations/20270121090000_search_eval.sql, each of which records their login, and
// one of which keeps a person's word over Jev's. No rule lives here: the database refuses what is not allowed.

export const REFUSED = 'The change was refused. Reload and try again.';

type Db = Pick<SupabaseClient, 'rpc'>;

const outcome = (error: { message: string } | null): EvalWrite => (error === null ? { ok: true } : { ok: false, message: REFUSED });

/** Adds a question to the product's set, with its category when one is given. */
export async function addQuestion(db: Db, product: string, question: string, category: string | null): Promise<EvalWrite> {
  const { error } = await db.rpc('search_eval_question_add', { p_product: product, p_question: question, ...(category === null ? {} : { p_category: category }) });
  return outcome(error);
}

/** Removes a question from the set. */
export async function removeQuestion(db: Db, question: string): Promise<EvalWrite> {
  const { error } = await db.rpc('search_eval_question_remove', { p_question: question });
  return outcome(error);
}

/** A person's word on one entry: `relevant` true confirms or adds it as a right answer, false removes it. */
export async function setAnswer(db: Db, question: string, entry: string, relevant: boolean): Promise<EvalWrite> {
  const { error } = await db.rpc('search_eval_answer_set', { p_question: question, p_entry: entry, p_relevant: relevant });
  return outcome(error);
}
