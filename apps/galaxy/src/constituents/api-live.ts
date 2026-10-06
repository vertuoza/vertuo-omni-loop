import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { installUrl } from '../signup/github-app';
import type { ConstituentsDeps } from './api';
import { serverEnv } from '../env';

// The constituents API's real dependencies: a Supabase client per call, acting as the caller's access
// token (never a service key), so constituents_for_repo() checks who calls. Without Supabase configured
// (the demo galaxy, a closed build) every call answers 503.
export function constituentsDeps(): ConstituentsDeps {
  if (!supabaseEnv()) return { connect: null };
  return { connect: supabaseAs, installLink: installUrl(serverEnv().githubAppSlug) };
}
