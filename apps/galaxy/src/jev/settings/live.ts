import 'server-only';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { masterKey } from '../secret-box';
import { jevStore } from '../store';
import { keyCheck, type KeyRouteDeps } from './api';

// Settings › Jev's key routes' real dependencies (./api.ts, PRD 812 s1). The store is the signed-in
// person's own Supabase session, so the migration's owner-only functions decide who may save or remove
// a key. The master key is SECRETS_MASTER_KEY; the test call reaches TypeSafe with the global fetch.

async function signedInStore() {
  if (!supabaseEnv()) return null;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? jevStore(db as unknown as Parameters<typeof jevStore>[0]) : null;
}

export function keyRouteDeps(): KeyRouteDeps {
  return {
    store: signedInStore,
    master: () => masterKey(process.env),
    test: (key) => keyCheck(key, fetch),
  };
}
