// The search eval jobs' database (PRD omni-loop-8 s4), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):
// the App has no person's session. It reads the search log and the eval set, and writes only through the functions
// the migration made for the service role (20270121090000_search_eval.sql):
//
//   searches        the grouped `search_knowledge` calls since a date: their group, product, workspace and category
//   joined          every group that ever joined a set, a removed question's included
//   promote         search_eval_question_promote(): the group's first question joins the set; null when it joined once
//   questionOf      a question's text, to ask galaxy about it
//   opened          the entries agents opened for a group
//   answerJev       search_eval_answer_jev(): Jev's answer, never over a person's; false when it wrote nothing
//   evalProducts    the products with a live question, or, for a pack, those of its workspaces that hold its repository
//   questions       a product's live questions, each with its right answers (the entries answered `relevant`, by Jev or
//                   a person)
//   recorded        whether the product holds a run of a trigger and slot
//   record          search_eval_run_record(): the run kept; null when the product holds one of that trigger and slot
//
// Throws when the database refuses or answers out of shape; a refusal names the database's message and code, never a
// question.
import { z } from 'zod';
import type { Json } from '../../../../supabase/database.types.ts';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { LoggedSearch } from './promote.ts';

/** A question of a set, and the entries that answer it. */
export type EvalQuestion = { id: string; productId: string; workspaceId: string; question: string; category: string | null; right: string[] };

/** A run to keep: its measures object and one entry per question. */
export type NewRun = { productId: string; trigger: 'daily' | 'embed'; slot: string; measures: Json; questions: Json[] };

export type SearchEvalStore = {
  searches: (sinceIso: string) => Promise<LoggedSearch[]>;
  joined: () => Promise<Set<string>>;
  promote: (input: { productId: string; groupId: string; category: string }) => Promise<string | null>;
  questionOf: (questionId: string) => Promise<string | null>;
  opened: (groupId: string) => Promise<string[]>;
  answerJev: (input: { questionId: string; entryId: string; relevant: boolean; confidence: number }) => Promise<boolean>;
  evalProducts: (filter?: { repository: string; workspaces: readonly string[] }) => Promise<string[]>;
  questions: (productId: string) => Promise<EvalQuestion[]>;
  recorded: (productId: string, trigger: 'daily' | 'embed', slot: string) => Promise<boolean>;
  record: (run: NewRun) => Promise<string | null>;
};

/** Rows per page of a paged read, and ids per `in` filter. */
const PAGE = 1000;
const CHUNK = 50;

export const LogRowSchema = z.object({ group_id: z.string().min(1), product_id: z.string().min(1), workspace_id: z.string().min(1), category: z.string().nullable() });
const GroupRowSchema = z.object({ group_id: z.string().min(1) });
const QuestionTextSchema = z.object({ question: z.string() });
const OpenedRowSchema = z.object({ opened_id: z.string().min(1) });
const ProductRowSchema = z.object({ product_id: z.string().min(1) });
const HolderRowSchema = z.object({ product_id: z.string().min(1) });
const LiveProductSchema = z.object({ id: z.string().min(1) });
const QuestionRowSchema = z.object({ id: z.string().min(1), product_id: z.string().min(1), workspace_id: z.string().min(1), question: z.string(), category: z.string().nullable() });
const AnswerRowSchema = z.object({ question_id: z.string().min(1), entry_id: z.string().min(1) });
const RunRowSchema = z.object({ id: z.string().min(1) });

type Answer = { data: unknown; error: { message: string; code?: string } | null };

/** A refusal thrown, naming the database's message and code; never a question. */
function refused(error: { message: string; code?: string }): Error {
  return new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

/** Every row a paged read answers: `page` is called with each range, until one comes back short. */
async function paged<T>(schema: z.ZodType<T>, page: (from: number, to: number) => PromiseLike<Answer>): Promise<T[]> {
  const rows: T[] = [];
  let start = 0;
  let size = PAGE;
  while (size === PAGE) {
    const batch = rowsOf(schema, await page(start, start + PAGE - 1));
    rows.push(...batch);
    size = batch.length;
    start += PAGE;
  }
  return rows;
}

const chunks = <T>(items: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** The store, as the service role on `connection`. */
export function searchEvalStore(connection: Connection): SearchEvalStore {
  const db = serviceDb(connection);

  async function liveQuestionProducts(): Promise<string[]> {
    const rows = await paged(ProductRowSchema, (from, to) => db.from('search_eval_questions').select('product_id').is('removed_at', null).order('id').range(from, to));
    return [...new Set(rows.map((row) => row.product_id))];
  }

  return {
    searches: async (sinceIso) => {
      const rows = await paged(LogRowSchema, (from, to) =>
        db.from('mcp_search_log').select('group_id, product_id, workspace_id, category').eq('tool', 'search_knowledge').not('group_id', 'is', null).gte('asked_at', sinceIso).order('asked_at').order('id').range(from, to));
      return rows.map((row) => ({ groupId: row.group_id, productId: row.product_id, workspaceId: row.workspace_id, category: row.category }));
    },

    joined: async () => {
      const rows = await paged(GroupRowSchema, (from, to) => db.from('search_eval_questions').select('group_id').not('group_id', 'is', null).order('id').range(from, to));
      return new Set(rows.map((row) => row.group_id));
    },

    promote: async ({ productId, groupId, category }) => {
      const { data, error } = await db.rpc('search_eval_question_promote', { p_product: productId, p_group: groupId, p_category: category });
      if (error) throw refused(error);
      return z.string().min(1).nullable().parse(data);
    },

    questionOf: async (questionId) => {
      const [row] = rowsOf(QuestionTextSchema, await db.from('search_eval_questions').select('question').eq('id', questionId).limit(1));
      return row?.question ?? null;
    },

    opened: async (groupId) => {
      const rows = rowsOf(OpenedRowSchema, await db.from('mcp_search_log').select('opened_id').eq('group_id', groupId).not('opened_id', 'is', null).order('asked_at').limit(200));
      return [...new Set(rows.map((row) => row.opened_id))];
    },

    answerJev: async ({ questionId, entryId, relevant, confidence }) => {
      const { data, error } = await db.rpc('search_eval_answer_jev', { p_question: questionId, p_entry: entryId, p_relevant: relevant, p_confidence: confidence });
      if (error) throw refused(error);
      return z.boolean().parse(data);
    },

    evalProducts: async (filter) => {
      const withQuestions = await liveQuestionProducts();
      if (!filter || withQuestions.length === 0 || filter.workspaces.length === 0) return filter ? [] : withQuestions;
      const holders = await paged(HolderRowSchema, (from, to) =>
        db.from('product_repositories').select('product_id').eq('repository', filter.repository).in('workspace_id', [...filter.workspaces]).order('product_id').range(from, to));
      const held = withQuestions.filter((id) => holders.some((holder) => holder.product_id === id));
      const live: string[] = [];
      for (const ids of chunks(held, CHUNK)) live.push(...rowsOf(LiveProductSchema, await db.from('products').select('id').in('id', ids).is('archived_at', null)).map((row) => row.id));
      return live;
    },

    questions: async (productId) => {
      const questions = await paged(QuestionRowSchema, (from, to) =>
        db.from('search_eval_questions').select('id, product_id, workspace_id, question, category').eq('product_id', productId).is('removed_at', null).order('added_at').order('id').range(from, to));
      const right = new Map<string, string[]>();
      for (const ids of chunks(questions.map((q) => q.id), CHUNK)) {
        const answers = await paged(AnswerRowSchema, (from, to) => db.from('search_eval_answers').select('question_id, entry_id').in('question_id', ids).eq('relevant', true).order('question_id').order('entry_id').range(from, to));
        for (const { question_id, entry_id } of answers) right.set(question_id, [...(right.get(question_id) ?? []), entry_id]);
      }
      return questions.map((q) => ({ id: q.id, productId: q.product_id, workspaceId: q.workspace_id, question: q.question, category: q.category, right: right.get(q.id) ?? [] }));
    },

    recorded: async (productId, trigger, slot) => {
      const rows = rowsOf(RunRowSchema, await db.from('search_eval_runs').select('id').eq('product_id', productId).eq('trigger', trigger).eq('slot', slot).limit(1));
      return rows.length > 0;
    },

    record: async ({ productId, trigger, slot, measures, questions }) => {
      const { data, error } = await db.rpc('search_eval_run_record', {
        p_product: productId,
        p_trigger: trigger,
        p_slot: slot,
        p_measures: measures,
        p_questions: questions,
      });
      if (error) throw refused(error);
      return z.string().min(1).nullable().parse(data);
    },
  };
}
