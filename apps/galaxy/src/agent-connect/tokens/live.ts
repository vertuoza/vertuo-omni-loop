import 'server-only';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import type { TokenRouteDeps } from './api';
import { agentTokenStore } from './store';
import { makeToken } from './token';

// Connect an agent's routes' real dependencies (./api.ts, PRD 855 s1): the store is the signed-in
// person's own Supabase session, never a service key (ADR-0051), so the migration's functions decide
// who may make or revoke a link; tokens are drawn with Web Crypto.

async function signedInStore() {
  if (!supabaseEnv()) return null;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? agentTokenStore(db as unknown as Parameters<typeof agentTokenStore>[0]) : null;
}

export function tokenRouteDeps(): TokenRouteDeps {
  return { store: signedInStore, draw: () => makeToken() };
}
