import 'server-only';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '../data/supabase-server';
import { installUrl } from '../signup/github-app';
import type { AskDeps } from './api';
import { jevDecideDeps } from '../jev/resolve-live';
import { classifierFromEnv } from './classify';
import { categoryThroughJev } from './classify-jev';
import type { Database } from '../../../../supabase/database.types';

// The ask API's real dependencies: a Supabase client per call, acting as the caller's access token
// (never a service key), so the database's row-level security has the last word. Without Supabase
// configured (the demo galaxy, a closed build) every ask call answers 503. A new round is sorted by
// OpenRouter after the response (Next's after()), and only when OPENROUTER_API_KEY is set: without it,
// rounds stay unsorted and nothing fails. A refusal for a repository no workspace owns ends with the
// App's install link (GITHUB_APP_SLUG), when this deployment has one. The category goes through the
// workspace's Jev decision (PRD 812) when this deployment has the service role to read it; without it,
// OpenRouter alone sorts, as before.
export function askDeps(): AskDeps {
  const env = supabaseEnv();
  if (!env) return { connect: null };
  const jev = jevDecideDeps(process.env);
  return {
    connect: (token) =>
      createClient<Database>(env.url, env.key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    classify: classifierFromEnv(process.env),
    decideCategory: jev ? categoryThroughJev(jev) : null,
    later: after,
    installLink: installUrl(process.env.GITHUB_APP_SLUG),
  };
}
