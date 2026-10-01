import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { installUrl } from '../signup/github-app';
import type { PitchLookDeps } from './pitch-look-api';

// The pitch look read's real dependencies (PRD 859 s1): a Supabase client per call, acting as the
// caller's access token (never a service key), so pitch_look_for_repo() checks who calls. Without
// Supabase configured (the demo galaxy, a closed build) every call answers 503.
export function pitchLookDeps(): PitchLookDeps {
  if (!supabaseEnv()) return { connect: null };
  return { connect: supabaseAs, installLink: installUrl(process.env.GITHUB_APP_SLUG) };
}
