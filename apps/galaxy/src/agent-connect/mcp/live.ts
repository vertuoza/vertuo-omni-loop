import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '../../data/supabase-server';
import type { McpDeps } from './server';

// The MCP link's real dependencies (./server.ts, PRD 855 s2): a Supabase client acting as nobody (the
// public anon key, no session), because the token is the credential and business_for_token() checks it
// in the database. Never a service key (ADR-0051). Without Supabase configured (the demo galaxy, a
// closed build) every tool says the business is not available here.
export function mcpDeps(): McpDeps {
  const env = supabaseEnv();
  if (!env) return { connect: null };
  return {
    connect: () => createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
}
