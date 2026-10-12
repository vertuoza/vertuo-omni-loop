import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import { installUrl } from '../signup/github-app';
import type { Phase0Deps } from './phase0-api';

// The phase 0 read's real dependencies (PRD 1299 s1), for /api/repositories/phase0: a Supabase client
// per call, acting as the caller's access token (never a service key), so repository_phase0() checks
// who calls. Without Supabase configured (the demo galaxy, a closed build) every call answers 503.
export function phase0Deps(): Phase0Deps {
  if (!supabaseEnv()) return { connect: null };
  return { connect: supabaseAs, installLink: installUrl(serverEnv().githubAppSlug) };
}
