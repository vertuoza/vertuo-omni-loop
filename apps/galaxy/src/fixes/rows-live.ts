import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { FixRowsDeps } from './rows';

// The Fixes rows' real dependencies: a Supabase client per call, acting as the caller's access token
// (never a service key), so fix_bug_push() checks who calls and row-level security has the last word.
// Without Supabase configured (the demo galaxy, a closed build) every push answers 503.
export function fixRowsDeps(): FixRowsDeps {
  return supabaseEnv() ? { connect: supabaseAs } : { connect: null };
}
