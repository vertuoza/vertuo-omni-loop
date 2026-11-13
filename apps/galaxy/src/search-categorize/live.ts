import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv, type ArcadeEnv } from '../env';
import { jevDecideDeps } from '../jev/resolve-live';
import type { SearchDomain } from '../jev/decisions/search-category';
import type { SearchCategorizeDeps } from './route';

// The search categorizer's real dependencies (./route.ts, PRD omni-loop-7 s2): SEARCH_CATEGORIZE_SECRET
// (server only, shared with omni-app), the resolver (../jev/resolve-live.ts) and the service role reading
// a product's active domains. Each is read per call.
export function searchCategorizeDeps(
  env: Pick<ArcadeEnv, 'searchCategorizeSecret' | 'supabase' | 'serviceRole' | 'secretsMasterKey'> = serverEnv(),
): SearchCategorizeDeps {
  return {
    secret: env.searchCategorizeSecret ?? undefined,
    jev: jevDecideDeps(env),
    domainsOf: activeDomains,
  };
}

async function activeDomains(workspaceId: string, productId: string): Promise<SearchDomain[]> {
  const { data, error } = await serviceDb()
    .from('product_domains')
    .select('key, name')
    .eq('workspace_id', workspaceId)
    .eq('product_id', productId)
    .is('retired_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase refused to read the domains: ${error.message}`);
  return data;
}
