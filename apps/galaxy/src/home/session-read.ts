import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types.ts';
import { signedIn, type SessionUser, type SignedInView } from './signed-in';

// The visitor's session, read in the browser once HOME is there (PRD 1006), as the Fleets and Ask
// pages read it: the page itself stays static and reaches no database. The read sits behind a small
// port, so the order is tested on fixtures. It never throws: no session, a failed read or no Supabase
// (the demo) is nobody signed in, and the page stays today's.

/** Where the session is read from; each read is allowed to throw. */
export interface SessionPort {
  user(): Promise<SessionUser | null>;
}

/** The pill for whoever is signed in, or null. `port` is null on the demo, which has no Supabase. */
export async function readSignedIn(port: SessionPort | null): Promise<SignedInView | null> {
  if (!port) return null;
  try {
    return signedIn(await port.user());
  } catch {
    return null;
  }
}

/** The galaxy's Supabase, as the browser reads it. Created on first read, never on the server. */
export function browserSessionPort(supabase: { url: string; key: string }): SessionPort {
  return {
    async user() {
      const db = createBrowserClient<Database>(supabase.url, supabase.key);
      const { data: { user } } = await db.auth.getUser();
      return user;
    },
  };
}
