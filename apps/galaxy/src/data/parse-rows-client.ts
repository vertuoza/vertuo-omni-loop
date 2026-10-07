// The client `pnpm schemas:verify` (scripts/schemas-verify.ts) runs every `*.boundary.ts` read with
// (PRD 1030): a Supabase client that only reads. Every request goes through a fetch that sends a GET
// or a HEAD and refuses anything else before it leaves, and PostgREST runs a GET in a read-only
// transaction, so even with the service role a boundary can write nothing: an insert, an update, a
// delete or an rpc not called with `{ get: true }` answers an error instead.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';

const READS = new Set(['GET', 'HEAD']);

/** `base`, sending only the requests that read. */
export function readOnlyFetch(base: typeof fetch): typeof fetch {
  return (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (READS.has(method)) return base(input, init);
    return Promise.reject(new Error(`schemas:verify only reads: a ${method} was refused`));
  };
}

/** A client of the database at `url`, as `key` (the service role's, for production), that only reads. */
export function readOnlyClient(url: string, key: string, base: typeof fetch = fetch): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: readOnlyFetch(base) },
  });
}
