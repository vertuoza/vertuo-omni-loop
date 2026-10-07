import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { installUrl } from '../signup/github-app';
import type { LoopDeps } from './api';
import { serverEnv } from '../env';

// The loops' real dependencies: a Supabase client per call, acting as the caller's access token (never
// a service key), so loop_push() checks who calls and row-level security has the last word. Without
// Supabase configured (the demo galaxy, a closed build) every push answers 503. A refusal for a
// repository no workspace owns ends with the App's install link (GITHUB_APP_SLUG), when this deployment
// has one.
export function loopDeps(): LoopDeps {
  if (!supabaseEnv()) return { connect: null };
  return { connect: supabaseAs, installLink: installUrl(serverEnv().githubAppSlug) };
}
