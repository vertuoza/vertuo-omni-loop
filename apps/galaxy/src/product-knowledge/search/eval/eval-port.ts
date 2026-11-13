import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../../supabase/database.types.ts';
import type { WriteSource } from '../../constituents/knowledge-reader';

// The Eval view's writes in the browser (PRD omni-loop-8 s5): the member functions of
// supabase/migrations/20270121090000_search_eval.sql, called as the signed-in person, so each records their login
// and a person's answer wins over Jev's. In the demo nothing is kept, and the port says so.

export type EvalWrite = { ok: true } | { ok: false; message: string };

export interface EvalPort {
  addQuestion(product: string, question: string, category: string | null): Promise<EvalWrite>;
  removeQuestion(question: string): Promise<EvalWrite>;
  /** A person's word on one entry: `relevant` true confirms or adds it, false removes it. */
  setAnswer(question: string, entry: string, relevant: boolean): Promise<EvalWrite>;
}

const DEMO_REFUSAL = 'The demo does not keep changes.';
const REFUSED = 'The change was refused. Reload and try again.';

const demoPort: EvalPort = {
  addQuestion: () => Promise.resolve({ ok: false, message: DEMO_REFUSAL }),
  removeQuestion: () => Promise.resolve({ ok: false, message: DEMO_REFUSAL }),
  setAnswer: () => Promise.resolve({ ok: false, message: DEMO_REFUSAL }),
};

const outcome = (error: { message: string } | null): EvalWrite => (error === null ? { ok: true } : { ok: false, message: REFUSED });

export const evalPortFor = (source: WriteSource): EvalPort => {
  if (source.kind === 'demo') return demoPort;
  const db = createBrowserClient<Database>(source.url, source.key);
  return {
    addQuestion: async (product, question, category) =>
      outcome((await db.rpc('search_eval_question_add', { p_product: product, p_question: question, ...(category === null ? {} : { p_category: category }) })).error),
    removeQuestion: async (question) => outcome((await db.rpc('search_eval_question_remove', { p_question: question })).error),
    setAnswer: async (question, entry, relevant) => outcome((await db.rpc('search_eval_answer_set', { p_question: question, p_entry: entry, p_relevant: relevant })).error),
  };
};
