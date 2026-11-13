// The one read behind the search categorizer (PRD omni-loop-7 s2): a product's active domains, oldest
// first, on the client it is given (the service role's, from ./live.ts). A refusal throws with the
// database's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { SearchDomain } from '../jev/decisions/search-category';

/** The product's domains not retired, in the order they were made. */
export async function activeDomains(
  db: SupabaseClient<Database>,
  workspaceId: string,
  productId: string,
): Promise<SearchDomain[]> {
  const { data, error } = await db
    .from('product_domains')
    .select('key, name')
    .eq('workspace_id', workspaceId)
    .eq('product_id', productId)
    .is('retired_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase refused to read the domains: ${error.message}`);
  return data;
}
