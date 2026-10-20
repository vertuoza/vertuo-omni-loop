// The product graph's reads (PRD 1798 s3; ADR-0095), on the client it is given: the caller's own, acting
// as their access token, so row-level security has the last word. A member reads their workspace's
// products, links, Legal entries, terms and Never lines, and the graphs of the repositories their
// workspaces list (supabase/migrations/20261215100000_knowledge_graphs.sql); a stranger reads nothing,
// and a product they cannot read is one that does not exist. Each answer is parsed where it comes in, a
// stored graph by the kit's own schema; a failed or out-of-shape read throws. No rule lives here.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RepositoryGraphSchema } from 'vertuo-omni-plan/kit/lib/knowledge/graph-schema.ts';
import type { Database } from '../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../data/parse-rows';

/** What the reads need: the tables. */
export type ProductGraphDb = Pick<SupabaseClient<Database>, 'from'>;

// `archived_at` is set once an owner archived the product (PRD 2232): row-level security still lets an owner read it.
const StoredProduct = z.object({ id: z.string().min(1), key: z.string().nullable(), name: z.string(), archived_at: z.string().nullable().optional() });
export type StoredProductRow = z.infer<typeof StoredProduct>;

const StoredLink = z.object({ repository: z.string().min(1), knowledge: z.enum(['own', 'imported', 'none']) });
const StoredLegal = z.object({ code: z.string().min(1), number: z.number().int(), statement: z.string(), retired_at: z.string().nullable() });
const StoredTerm = z.object({ term: z.string().min(1), meaning: z.string(), removed_at: z.string().nullable() });
const StoredNever = z.object({ seq: z.number().int(), body: z.string(), removed_at: z.string().nullable() });
const StoredGraph = z.object({ sha: z.string().min(1), graph: RepositoryGraphSchema, pushed_at: z.string().min(1), pushed_by_login: z.string().nullable() });
export type StoredGraphRow = z.infer<typeof StoredGraph>;

const PRODUCT_COLUMNS = 'id, key, name, archived_at';

/** The rows of a read, or a thrown error naming it. */
function rowsOf<T>(schema: z.ZodType<T>, { data, error }: { data: unknown; error: { message: string } | null }, what: string, table: string): T[] {
  if (error) throw new Error(`read ${what}: ${error.message}`);
  return orThrow(parseRows(schema, data, `knowledge-graph: ${table}`));
}

export function productGraphRepository(db: ProductGraphDb) {
  return {
    /** The product keyed `key` the caller reads: a live one before an archived one, then the oldest, when two of their workspaces hold the key. */
    async productByKey(key: string): Promise<StoredProductRow | null> {
      const answer = await db.from('products').select(PRODUCT_COLUMNS).eq('key', key).order('archived_at', { ascending: true, nullsFirst: true }).order('created_at').order('id').limit(1);
      return rowsOf(StoredProduct, answer, `the product ${key}`, 'products')[0] ?? null;
    },

    /** The product `id` names, when the caller reads it. */
    async productById(id: string): Promise<StoredProductRow | null> {
      const answer = await db.from('products').select(PRODUCT_COLUMNS).eq('id', id).limit(1);
      return rowsOf(StoredProduct, answer, `the product ${id}`, 'products')[0] ?? null;
    },

    /** The product's links: each repository (owner/name) and where its knowledge lives. */
    async links(product: string) {
      const answer = await db.from('product_repositories').select('repository, knowledge').eq('product_id', product).order('repository');
      return rowsOf(StoredLink, answer, 'the links of the product', 'product_repositories');
    },

    /** Every Legal entry of the product, retired ones included. */
    async legal(product: string) {
      const answer = await db.from('product_legal').select('code, number, statement, retired_at').eq('product_id', product).order('code').order('number');
      return rowsOf(StoredLegal, answer, 'the Legal entries of the product', 'product_legal');
    },

    /** Every term of the product's glossary, removed ones included. */
    async glossary(product: string) {
      const answer = await db.from('product_glossary').select('term, meaning, removed_at').eq('product_id', product).order('term');
      return rowsOf(StoredTerm, answer, 'the glossary of the product', 'product_glossary');
    },

    /** Every Never line of the product, removed ones included. */
    async never(product: string) {
      const answer = await db.from('constituents').select('seq, body, removed_at').eq('product_id', product).eq('kind', 'never').order('seq');
      return rowsOf(StoredNever, answer, 'the Never lines of the product', 'constituents');
    },

    /** The graph of `repository` (owner/name, lower case) pushed last, or null when it never pushed or the caller reads none. */
    async latestGraph(repository: string): Promise<StoredGraphRow | null> {
      const answer = await db.from('knowledge_graphs').select('sha, graph, pushed_at, pushed_by_login').eq('repository', repository).order('pushed_at', { ascending: false }).limit(1);
      return rowsOf(StoredGraph, answer, `the graph of ${repository}`, 'knowledge_graphs')[0] ?? null;
    },
  };
}

export type ProductGraphRepository = ReturnType<typeof productGraphRepository>;
