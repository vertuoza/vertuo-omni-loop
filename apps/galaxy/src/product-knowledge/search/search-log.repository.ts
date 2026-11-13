import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseRows } from '../../data/parse-rows';
import type { SearchRow } from './search-stats';

// The Search section's storage (PRD omni-loop-6 s3; ADR-0095), on the client it is given, the signed-in
// person's, so row-level security decides what it returns: a member reads their workspace's rows, a member of
// another workspace none (BR-PRODUCT-63). The searches of a product asked since a day, newest first. No rule
// lives here, and a row holds no key (L-GDPR-2).

const StoredSearch = z.object({
  id: z.string(),
  query: z.string().nullable(),
  mode: z.enum(['meaning', 'words']).nullable(),
  total: z.number(),
  hit_ids: z.array(z.string()),
  opened_rank: z.number().nullable(),
  asked_at: z.string(),
});

/** The table answers a thousand rows at most per read: the section reads up to this many pages of them. */
const PAGE = 1000;
const MOST_PAGES = 5;

const COLUMNS = 'id, query, mode, total, hit_ids, opened_rank, asked_at';

/** The searches of `product` asked at or after `since` (an ISO time), newest first; null when they cannot be read. */
export async function searchesOf(db: Pick<SupabaseClient, 'from'>, product: string, since: string): Promise<SearchRow[] | null> {
  const rows: SearchRow[] = [];
  for (let page = 0; page < MOST_PAGES; page++) {
    const { data, error } = await db.from('mcp_search_log').select(COLUMNS)
      .eq('product_id', product).eq('tool', 'search_knowledge').gte('asked_at', since)
      .order('asked_at', { ascending: false }).range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) return null;
    const parsed = parseRows(StoredSearch, data, 'product-knowledge/search-log.repository: mcp_search_log');
    if (!parsed.ok) return null;
    rows.push(...parsed.value.map((r) => ({
      id: r.id, query: r.query, mode: r.mode, total: r.total, hitIds: r.hit_ids, openedRank: r.opened_rank, askedAt: r.asked_at,
    })));
    if (parsed.value.length < PAGE) break;
  }
  return rows;
}
