// The arcade's health query (PRD 1723, s3; ADR-0095): whether the galaxy's database answers. One
// read-only query of public.releases, the table anyone may read (its migration's one select policy),
// asked as nobody with the publishable key, no session kept and no cookie read, as /releases reads it
// (../releases/store.ts). A head request: no row comes back, only whether the database answered. No rule
// lives here: the service decides what an answer means, and how long it waits for one.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { SupabaseEnv } from '../env.ts';

/** No session: nothing stored, nothing refreshed, nothing read from the address. */
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

/** The one call the probe makes of a client. */
type Probe = { from(table: 'releases'): { select(columns: 'prd', options: { head: true }): { limit(count: 1): PromiseLike<{ error: unknown }> } } };

type Connect = (url: string, key: string, options: typeof NO_SESSION) => Probe;

const anonymous: Connect = (url, key, options): Pick<SupabaseClient<Database>, 'from'> => createClient<Database>(url, key, options);

/** Whether the galaxy's database answers. */
export type HealthProbe = {
  /** Resolves when the database answered the query; throws when it refused, or is not configured here. */
  ping(): Promise<void>;
};

export function healthRepository(env: SupabaseEnv | null, connect: Connect = anonymous): HealthProbe {
  return {
    async ping() {
      if (!env) throw new Error('Supabase is not configured');
      const { error } = await connect(env.url, env.key, NO_SESSION).from('releases').select('prd', { head: true }).limit(1);
      if (error) throw new Error('the health query was refused');
    },
  };
}
