import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';

// The galaxy database, from the server. Configured by the two public variables; with neither set the
// app plays the demo galaxy and nothing signs in.
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** A client that acts as the signed-in player (their session cookies), so row-level security applies. */
export async function supabaseServer() {
  const env = supabaseEnv();
  if (!env) throw new Error('Supabase is not configured');
  const store = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      // A page render cannot set cookies; the proxy (proxy.ts) refreshes the session before it.
      setAll(list) {
        try { for (const { name, value, options } of list) store.set(name, value, options); } catch { /* rendering */ }
      },
    },
  });
}

/** A client that acts as one access token and keeps nothing: a sign-in the browser does not hold
 * (the terminal's, in the auth callback). */
export function supabaseAs(accessToken: string) {
  const env = supabaseEnv();
  if (!env) throw new Error('Supabase is not configured');
  return createClient<Database>(env.url, env.key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
