import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv, type ArcadeEnv } from '../env';
import { askJev } from './client';
import { openKey, type JevDecideDeps } from './resolve';
import { masterKey } from './secret-box';
import { jevServiceStore } from './store';

// The resolver's real dependencies (./resolve.ts, PRD 812 s2), for Galaxy's server only: the service
// role reads a decision's settings and the sealed key, which SECRETS_MASTER_KEY opens, logs each call,
// and Jev is reached with the global fetch. Without SUPABASE_SERVICE_ROLE_KEY there are none, and every
// decision is made as before.

export function jevDecideDeps(env: Pick<ArcadeEnv, 'supabase' | 'serviceRole' | 'secretsMasterKey'> = serverEnv()): JevDecideDeps | null {
  if (!env.supabase || !env.serviceRole) return null;
  const store = jevServiceStore(serviceDb());
  const master = masterKey(env.secretsMasterKey);
  return {
    settings: (workspace, decision) => store.decision(workspace, decision),
    key: async (workspace) => openKey(await store.sealedKey(workspace), master),
    ask: (key, state, question) => askJev({ key, state, question, fetch }),
    log: (workspace, call) => store.logCall(workspace, call),
  };
}
