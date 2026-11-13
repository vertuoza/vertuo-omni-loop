import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { knowledgeReader, writeSourceOf, type KnowledgeReader, type WriteSource } from '../../constituents/knowledge-reader';
import { demoEval } from './eval-demo';
import { answersOf, questionsOf, runsOf } from './eval.repository';
import type { EvalAnswer, EvalQuestion, EvalRun } from './eval-stats';

// The Eval view's read (PRD omni-loop-8 s5), as the signed-in person, so row-level security decides what it returns:
// the product's runs, its set of questions and their answers, with what the browser needs to write as the same
// person. In the demo, its in-memory rows. Null when they cannot be read: the view says so and the page still opens.

export interface EvalData {
  source: WriteSource;
  runs: EvalRun[];
  questions: EvalQuestion[];
  answers: EvalAnswer[];
}

/** What the signed-in person reads of the product's set, or null when any read fails. */
async function fromDatabase(reader: Extract<KnowledgeReader, { kind: 'database' }>, product: string): Promise<EvalData | null> {
  const [runs, questions, answers] = await Promise.all([runsOf(reader.db, product), questionsOf(reader.db, product), answersOf(reader.db)]);
  if (runs === null || questions === null || answers === null) return null;
  const mine = new Set(questions.map((q) => q.id));
  return { source: writeSourceOf(reader), runs, questions, answers: answers.filter((a) => mine.has(a.questionId)) };
}

/** The product's eval data, or null when it cannot be read. */
export async function loadEval(product: string, now: number): Promise<EvalData | null> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') {
    const demo = demoEval(product, now);
    return demo === null ? null : { source: { kind: 'demo' }, ...demo };
  }
  if (reader.kind !== 'database') return null;
  const read = await fromDatabase(reader, product);
  if (read === null) log.error({ event: 'product-knowledge-search-eval', outcome: 'failed', message: 'the eval runs, set or answers could not be read' });
  return read;
}
