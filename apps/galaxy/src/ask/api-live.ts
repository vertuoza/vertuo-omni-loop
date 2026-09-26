import 'server-only';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '../data/supabase-server';
import type { AskDeps } from './api';
import { classifierFromEnv } from './classify';

// The ask API's real dependencies: a Supabase client per call, acting as the caller's access token
// (never a service key), so the database's row-level security has the last word. Without Supabase
// configured (the demo galaxy, a closed build) every ask call answers 503. A new round is sorted by
// OpenRouter after the response (Next's after()), and only when OPENROUTER_API_KEY is set: without it,
// rounds stay unsorted and nothing fails.
export function askDeps(): AskDeps {
  const env = supabaseEnv();
  if (!env) return { connect: null };
  return {
    connect: (token) =>
      createClient(env.url, env.key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    classify: classifierFromEnv(process.env),
    later: after,
  };
}
