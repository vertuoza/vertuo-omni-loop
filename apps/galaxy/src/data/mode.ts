// Which arcade a build serves. Only a configured Supabase lets anyone in, through Google sign-in.
// The demo (a simulated sign-in on a fictional galaxy) is for local development, or for a build
// that asks for it by name; any other build without Supabase is closed: the attract mode, and an
// INSERT COIN screen that says sign-in is not open yet.
export type ArcadeMode = 'supabase' | 'demo' | 'closed';

export function arcadeMode(env: Record<string, string | undefined>): ArcadeMode {
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 'supabase';
  if (env.NODE_ENV !== 'production' || env.OMNI_LOOP_DEMO === '1') return 'demo';
  return 'closed';
}
