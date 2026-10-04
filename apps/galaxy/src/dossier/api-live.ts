import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { supabaseEnv } from '../data/supabase-server';
import { installUrl } from '../signup/github-app';
import type { DossierDeps } from './api';
import { serverEnv } from '../env';

// The dossier API's real dependencies: a Supabase client per call, acting as the caller's access
// token (never a service key), so dossier_open() and dossier_push() check who calls and row-level
// security has the last word. Without Supabase configured (the demo galaxy, a closed build) every
// dossier call answers 503. A refusal for a repository no workspace owns ends with the App's install
// link (GITHUB_APP_SLUG), when this deployment has one.
export function dossierDeps(): DossierDeps {
  const env = supabaseEnv();
  if (!env) return { connect: null };
  return {
    connect: (token) =>
      createClient<Database>(env.url, env.key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    installLink: installUrl(serverEnv().githubAppSlug),
  };
}
