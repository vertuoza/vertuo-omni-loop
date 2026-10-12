// The sign-in module (PRD 1318, ADR-0095): the one browser module allowed to build a Supabase
// client, because signing in and out is authentication, not data. Every other browser file reads and
// writes through its area's `*.client.ts`, which calls the app's routes (scripts/layering-guard.test.ts).
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types.ts';

/** The Supabase public pair the browser signs in with. */
type PublicPair = { url: string; key: string };

/** Signs this browser out: its session cookies go, and the next page load is signed out. */
export async function signOutHere(supabase: PublicPair): Promise<void> {
  await createBrowserClient<Database>(supabase.url, supabase.key).auth.signOut();
}
