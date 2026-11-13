'use server';
import { knowledgeReader } from '../../constituents/knowledge-reader';
import type { EvalWrite } from './eval-stats';
import { REFUSED, addQuestion, removeQuestion, setAnswer } from './eval-write.repository';

// The Eval view's server actions (PRD omni-loop-8 s5): what a member changes, written as the signed-in person, so
// the database functions record their login and row-level security decides who may. The demo keeps nothing, and says
// so. Nothing else moves: the rules are the database's (eval-write.repository.ts).

const DEMO_REFUSAL = 'The demo does not keep changes.';

/** Runs one write as the signed-in person; the demo refuses, and nobody who can read cannot write. */
async function asMember(write: (db: Extract<Awaited<ReturnType<typeof knowledgeReader>>, { kind: 'database' }>['db']) => Promise<EvalWrite>): Promise<EvalWrite> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') return { ok: false, message: DEMO_REFUSAL };
  return reader.kind === 'database' ? write(reader.db) : { ok: false, message: REFUSED };
}

export async function addEvalQuestion(product: string, question: string, category: string | null): Promise<EvalWrite> {
  return asMember((db) => addQuestion(db, product, question, category));
}

export async function removeEvalQuestion(question: string): Promise<EvalWrite> {
  return asMember((db) => removeQuestion(db, question));
}

export async function setEvalAnswer(question: string, entry: string, relevant: boolean): Promise<EvalWrite> {
  return asMember((db) => setAnswer(db, question, entry, relevant));
}
