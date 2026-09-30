import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import type { ProofDeps } from './api';
import { proofPublic, proofStore } from './store';

// The proof API's real dependencies. The two kit calls run as the caller's access token (never a
// service key), so the bucket's rules and proof_run_add() decide who may upload and register. The GIF's
// stable link reads as the service role (SUPABASE_SERVICE_ROLE_KEY), the only way a link without sign-in
// can be signed; it reads a run's GIF path and nothing else. Without Supabase configured (the demo
// galaxy) the kit calls answer 503, and without the service key the GIF link does.
export function proofDeps(): ProofDeps {
  const hasDb = supabaseEnv() !== null;
  const hasService = hasDb && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    connect: hasDb
      ? (token) => {
          const client = supabaseAs(token);
          return { auth: client.auth, proofs: proofStore(client) };
        }
      : null,
    open: hasService ? () => proofPublic(serviceDb()) : null,
  };
}
