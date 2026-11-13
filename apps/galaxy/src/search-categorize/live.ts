import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv, type ArcadeEnv } from '../env';
import { jevDecideDeps } from '../jev/resolve-live';
import { activeDomains } from './domains.repository';
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
    domainsOf: (workspaceId, productId) => activeDomains(serviceDb(), workspaceId, productId),
  };
}
