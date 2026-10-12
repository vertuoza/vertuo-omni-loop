import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { serverEnv, type ArcadeEnv } from '../env';
import { supabaseServer } from './supabase-server';

// The database module (PRD 1318, ADR-0095): the one module that builds the galaxy's database client,
// and the only one a repository (`*.repository.ts`) imports. Controllers and services never import it
// (scripts/layering-guard.test.ts). Row-level security stays the second wall: a repository reads as
// the signed-in person, unless ADR-0051 names its read for the service role.

/** The signed-in person's client, from the request's session cookies: row-level security applies. */
export function userDb() {
  return supabaseServer();
}

/** The service role's client, for the reads ADR-0051 names only. Throws when this deployment has no
 * service role key. */
export function serviceRoleDb() {
  const { url, key } = serviceRolePair(serverEnv());
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** The service role's address and key: its own address when set, the public pair's otherwise. */
function serviceRolePair({ supabase, serviceRole }: Pick<ArcadeEnv, 'supabase' | 'serviceRole'>): { url: string; key: string } {
  const url = serviceRole?.url ?? supabase?.url;
  if (!url || !serviceRole) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on this deployment');
  return { url, key: serviceRole.key };
}
