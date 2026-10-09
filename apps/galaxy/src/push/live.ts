import 'server-only';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import type { AlertRouteDeps } from './api';
import { alertStore } from './store';

// The alert routes' real dependencies (./api.ts, PRD 1322 s9): the signed-in person's own Supabase
// session, read from their cookies and checked with Supabase Auth, so row-level security keeps every
// write to their own rows. Nobody signed in, or no database: null, and the route answers 401.

const signedIn: AlertRouteDeps['session'] = async () => {
  if (!supabaseEnv()) return null;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? { userId: user.id, store: alertStore(db) } : null;
};

export function alertRouteDeps(): AlertRouteDeps {
  return { session: signedIn };
}
