import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '../data/supabase-server';
import { installUrl } from '../signup/github-app';
import type { BusinessDeps } from './api';

// The business API's real dependencies: a Supabase client per call, acting as the caller's access
// token (never a service key), so business_for_repo() checks who calls and row-level security has the
// last word. Without Supabase configured (the demo galaxy, a closed build) every call answers 503.
export function businessDeps(): BusinessDeps {
  const env = supabaseEnv();
  if (!env) return { connect: null };
  return {
    connect: (token) =>
      createClient(env.url, env.key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    installLink: installUrl(process.env.GITHUB_APP_SLUG),
  };
}
