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
import { serverEnv } from '../env';
import { viewer } from '../data/viewer';

// The ask API's real dependencies: a Supabase client per call, acting as the caller's access token
// (never a service key), so the database's row-level security has the last word. Without Supabase
// configured (the demo galaxy, a closed build) every ask call answers 503. A new round is sorted by
// OpenRouter after the response (Next's after()), and only when OPENROUTER_API_KEY is set: without it,
// rounds stay unsorted and nothing fails. A refusal for a repository no workspace owns ends with the
// App's install link (GITHUB_APP_SLUG), when this deployment has one. The category goes through the
// workspace's Jev decision (PRD 812) when this deployment has the service role to read it; without it,
// OpenRouter alone sorts, as before. A request with no bearer token is a page's (PRD 1318, s3): the
// person its sign-in cookie names, read from the claims as every page reads them (viewer()), acting
// on the viewer's own client, so row-level security decides there too.
export function askDeps(): AskDeps {
  const env = supabaseEnv();
  if (!env) return { connect: null };
  const jev = jevDecideDeps(serverEnv());
  return {
    connect: (token) =>
      createClient<Database>(env.url, env.key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    async cookie() {
      const seen = await viewer();
      return seen.kind === 'signed-in' ? { caller: { id: seen.user.id, email: seen.user.email ?? null }, client: seen.db } : null;
    },
    classify: classifierFromEnv(serverEnv().openrouter),
    decideCategory: jev ? categoryThroughJev(jev) : null,
    later: after,
    installLink: installUrl(serverEnv().githubAppSlug),
  };
}
