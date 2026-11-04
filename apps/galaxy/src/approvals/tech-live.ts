import 'server-only';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { reachDeps } from './approvals-live';
import type { TechRouteDeps } from './tech.controller';
import { techRepository } from './tech.repository';

// A Tech Approval route's real dependencies (PRD 2608 s3): the request runs as the caller (a terminal's
// access token, or the page's own session), never a service key, so dossier_request_tech_approval() checks
// who asks; the person named is reached as approvals-live.ts reaches anyone. Without Supabase configured
// (the demo galaxy) every call answers 503.

export function techDeps(): TechRouteDeps {
  if (!supabaseEnv()) return { ...reachDeps(), connect: null, session: () => Promise.resolve(null) };
  return {
    ...reachDeps(),
    connect: (token) => {
      const client = supabaseAs(token);
      return { auth: client.auth, tech: techRepository(client) };
    },
    async session() {
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? techRepository(db) : null;
    },
  };
}
