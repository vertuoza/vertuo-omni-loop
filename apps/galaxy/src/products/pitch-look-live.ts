import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import { installUrl } from '../signup/github-app';
import type { PitchSettingsDeps } from './pitch-settings-api';

// The Pitch settings reads' real dependencies (PRD 859 s1, PRD 1108 s1), for /api/pitch-settings and its
// alias /api/pitch-look: a Supabase client per call, acting as the caller's access token (never a
// service key), so pitch_settings_for_repo() checks who calls. Without Supabase configured (the demo
// galaxy, a closed build) every call answers 503.
export function pitchSettingsDeps(): PitchSettingsDeps {
  if (!supabaseEnv()) return { connect: null };
  return { connect: supabaseAs, installLink: installUrl(serverEnv().githubAppSlug) };
}
