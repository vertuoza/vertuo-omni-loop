import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseRows } from '../../../data/parse-rows';
import type { CategorizedRow, GroupHead } from './categories-stats';

// The Categories view's storage (PRD omni-loop-7 s4; ADR-0095), on the client it is given, the signed-in
// person's, so row-level security decides what it returns: a member reads their workspace's searches and groups,
// a member of another workspace none (BR-PRODUCT-63). No rule lives here, and a row holds no key (L-GDPR-2).

/** A search as the view reads it: no hit is shown here, so none is read. */
const StoredSearch = z.object({
  id: z.string(), query: z.string().nullable(), mode: z.enum(['meaning', 'words']).nullable(), total: z.number(),
  opened_rank: z.number().nullable(), asked_at: z.string(), category: z.string().nullable(), group_id: z.string().nullable(),
});

const StoredGroup = z.object({ id: z.string(), question: z.string() });

/** The tables answer a thousand rows at most per read: the view reads up to this many pages of each. */
const PAGE = 1000;
const MOST_PAGES = 5;

const COLUMNS = 'id, query, mode, total, opened_rank, asked_at, category, group_id';

type Db = Pick<SupabaseClient, 'from'>;
type Page = (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>;

/** Every page of a read, parsed; null on a refusal or a row out of shape. */
async function pagesOf<T>(schema: z.ZodType<T>, read: Page, where: string): Promise<T[] | null> {
  const rows: T[] = [];
  for (let page = 0; page < MOST_PAGES; page++) {
    const { data, error } = await read(page * PAGE, (page + 1) * PAGE - 1);
    if (error) return null;
    const parsed = parseRows(schema, data, where);
    if (!parsed.ok) return null;
    rows.push(...parsed.value);
    if (parsed.value.length < PAGE) break;
  }
  return rows;
}

/** The searches of `product` asked at or after `since` (an ISO time), newest first, with their category and group. */
export async function categorizedSearchesOf(db: Db, product: string, since: string): Promise<CategorizedRow[] | null> {
  const rows = await pagesOf(StoredSearch, (from, to) => db.from('mcp_search_log').select(COLUMNS)
    .eq('product_id', product).eq('tool', 'search_knowledge').gte('asked_at', since)
    .order('asked_at', { ascending: false }).range(from, to), 'product-knowledge/categories.repository: mcp_search_log');
  return rows?.map((r) => ({
    id: r.id, query: r.query, mode: r.mode, total: r.total, hitIds: [], openedRank: r.opened_rank, askedAt: r.asked_at,
    category: r.category, groupId: r.group_id,
  })) ?? null;
}

/** The groups of `product`, each with its first question; null when they cannot be read. */
export async function groupHeadsOf(db: Db, product: string): Promise<GroupHead[] | null> {
  return pagesOf(StoredGroup, (from, to) => db.from('mcp_search_groups').select('id, question')
    .eq('product_id', product).order('created_at', { ascending: true }).range(from, to), 'product-knowledge/categories.repository: mcp_search_groups');
}

/** This module's two reads as `pnpm schemas:verify` runs them, a few rows each, with their schemas (categories.boundary.ts). */
export const boundaryReads = [
  { name: 'product-knowledge/categories.repository: mcp_search_log', read: (db: Db) => db.from('mcp_search_log').select(COLUMNS).eq('tool', 'search_knowledge').limit(5), schema: StoredSearch },
  { name: 'product-knowledge/categories.repository: mcp_search_groups', read: (db: Db) => db.from('mcp_search_groups').select('id, question').limit(5), schema: StoredGroup },
] as const;
