import 'server-only';
import { supabaseAs, supabaseEnv } from '../../data/supabase-server';
import type { IdeasApiDeps } from './api';
import { ideasPort } from './store';

// The ideas API's real dependencies (PRD 1246, s2): a Supabase client per call, acting as the caller's
// access token (never a service key), so row-level security has the last word on who adds an idea and
// who reads a board. Without Supabase configured (the demo galaxy, a closed build) every call answers 503.
export function ideasApiDeps(): IdeasApiDeps {
  if (!supabaseEnv()) return { connect: null };
  return {
    connect: (token) => {
      const db = supabaseAs(token);
      return { auth: db.auth, ideas: ideasPort(db) };
    },
  };
}
