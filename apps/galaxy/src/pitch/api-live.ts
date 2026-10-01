import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { PitchDeps } from './api';
import { pitchPublic, pitchStore } from './store';

// The pitch API's real dependencies, as the proof API's (../proof/api-live.ts). The two kit calls run as
// the caller's access token (never a service key), so the bucket's rules and pitch_run_add() decide who
// may upload and register. The GIF's stable link reads as the service role (SUPABASE_SERVICE_ROLE_KEY),
// the only way a link without sign-in can be signed; it reads a run's dossier and files and nothing
// else. Without Supabase configured (the demo galaxy) the kit calls answer 503, and without the service
// key the GIF link does.
export function pitchDeps(): PitchDeps {
  const hasDb = supabaseEnv() !== null;
  const hasService = hasDb && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    connect: hasDb
      ? (token) => {
          const client = supabaseAs(token);
          return { auth: client.auth, pitches: pitchStore(client) };
        }
      : null,
    open: hasService ? () => pitchPublic(serviceDb()) : null,
  };
}
