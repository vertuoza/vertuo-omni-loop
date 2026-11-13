// The `search-categorize` job's database (PRD omni-loop-7 s3), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`): the App has no person's session.
//
//   ungrouped    the searches with no group: `search_knowledge` calls that kept a question (the ungrouped index of
//                20270120093000_mcp_search_groups.sql), the oldest first, at most `limit`
//   nearest      mcp_search_group_nearest(): the product's nearest group of a model to a vector, with its cosine
//   addGroup     a group started by a search: its question, its vector and the model that made it; its id
//   join         sets a search's group
//   setCategory  sets a search's category
//
// Throws when the database refuses or answers out of shape. A vector travels as pgvector's text, `[a,b,…]`.
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { Nearest } from './group.ts';

/** A search not yet grouped: its id, its product and workspace, and the question it asked. */
export type Ungrouped = { id: string; productId: string; workspaceId: string; question: string };

/** A group to start. */
export type NewGroup = { productId: string; workspaceId: string; firstSearchId: string; question: string; model: string; vector: readonly number[] };

export type SearchStore = {
  ungrouped: (limit: number) => Promise<Ungrouped[]>;
  nearest: (productId: string, model: string, vector: readonly number[]) => Promise<Nearest | null>;
  addGroup: (group: NewGroup) => Promise<string>;
  join: (searchId: string, groupId: string) => Promise<void>;
  setCategory: (searchId: string, category: string) => Promise<void>;
};

export const UngroupedRowSchema = z.object({ id: z.string().min(1), product_id: z.string().min(1), workspace_id: z.string().min(1), query: z.string().min(1) });
const NearestRowSchema = z.object({ group_id: z.string().min(1), cosine: z.number() });
const GroupIdSchema = z.object({ id: z.string().min(1) });

/** pgvector's text form of a vector. */
export const vectorText = (vector: readonly number[]): string => `[${vector.join(',')}]`;

/** A refusal thrown, naming the database's message and code; never a question. */
function refused(error: { message: string; code?: string }): Error {
  return new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

/** The store, as the service role on `connection`. */
export function searchStore(connection: Connection): SearchStore {
  const db = serviceDb(connection);
  return {
    ungrouped: async (limit) => {
      const rows = rowsOf(
        UngroupedRowSchema,
        await db.from('mcp_search_log').select('id, product_id, workspace_id, query').is('group_id', null).eq('tool', 'search_knowledge').not('query', 'is', null).order('asked_at').limit(limit),
      );
      return rows.map((row) => ({ id: row.id, productId: row.product_id, workspaceId: row.workspace_id, question: row.query }));
    },

    nearest: async (productId, model, vector) => {
      const { data, error } = await db.rpc('mcp_search_group_nearest', { p_product: productId, p_model: model, p_query: vectorText(vector) });
      if (error) throw refused(error);
      const [row] = z.array(NearestRowSchema).parse(data);
      return row ? { groupId: row.group_id, cosine: row.cosine } : null;
    },

    addGroup: async ({ productId, workspaceId, firstSearchId, question, model, vector }) => {
      const answer = await db
        .from('mcp_search_groups')
        .insert({ product_id: productId, workspace_id: workspaceId, first_search_id: firstSearchId, question, model, embedding: vectorText(vector) })
        .select('id')
        .single();
      if (answer.error) throw refused(answer.error);
      return GroupIdSchema.parse(answer.data).id;
    },

    join: async (searchId, groupId) => {
      const { error } = await db.from('mcp_search_log').update({ group_id: groupId }).eq('id', searchId);
      if (error) throw refused(error);
    },

    setCategory: async (searchId, category) => {
      const { error } = await db.from('mcp_search_log').update({ category }).eq('id', searchId);
      if (error) throw refused(error);
    },
  };
}
