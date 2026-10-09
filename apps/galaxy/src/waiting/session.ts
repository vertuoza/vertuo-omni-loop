import type { SupabaseClient } from '@supabase/supabase-js';

// The waiting list's browser reads go to the database only while the browser holds a session (bug
// #1316). An expired sign-in leaves the browser client with the public key, which the database refuses
// (42501) on every poll. getSession() reads the session the client keeps, with no database request
// (an expired token is refreshed through Auth, never through the database), so a reader asks it first
// and, without one, reads nothing and throws SignedOut: the waiting provider then stops that poll.

/** What the gate reads of a client: its own session. A client without getSession (a test's fake) is not
 * gated; every real Supabase client has it. */
export type SessionAuth = { auth?: Partial<Pick<SupabaseClient['auth'], 'getSession'>> };

/** The browser holds no session: nothing was read, and polling should stop. */
export class SignedOut extends Error {
  constructor() {
    super('signed out: the browser holds no session, so nothing was read');
    this.name = 'SignedOut';
  }
}

/** Resolves when `db` may read as the signed-in person; throws SignedOut when it holds no session. */
export async function holdSession(db: SessionAuth): Promise<void> {
  if (!db.auth?.getSession) return;
  const { data } = await db.auth.getSession();
  if (!data.session) throw new SignedOut();
}
