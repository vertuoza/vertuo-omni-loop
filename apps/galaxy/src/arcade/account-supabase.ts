// The production account: Google sign-in and GitHub linking through Supabase Auth, the player's row
// through the database, in the workspace the page plays (src/data/players.ts), with row-level
// security deciding what they may change (their name, fleet and hero; never their GitHub login,
// which comes from the linked identity), and refusing a row to a visitor who has not linked GitHub.
import { createBrowserClient } from '@supabase/ssr';
import { savePlayer } from '../data/players';
import type { Account, Player, PlayerPatch } from './types';

/** `workspace`: the id of the workspace the page plays, where joining a fleet writes the player row;
 * null for a person who belongs to none. */
export function supabaseAccount({ url, key, workspace }: { url: string; key: string; workspace: string | null }): Account {
  // Created on first use, in the browser: the server's pre-render of the arcade never needs it.
  let client: ReturnType<typeof createBrowserClient> | null = null;
  const db = new Proxy({} as ReturnType<typeof createBrowserClient>, {
    get: (_, prop) => Reflect.get((client ??= createBrowserClient(url, key)), prop),
  });
  const callback = (next?: string) => `${window.location.origin}/auth/callback${next ? `?next=${next}` : ''}`;
  const fail = (what: string, message: string) => new Error(`${what}: ${message}`);
  return {
    kind: 'supabase',
    async signIn() {
      const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        // hd filters Google's account chooser; the sign-in hook and every policy enforce membership.
        options: { redirectTo: callback(), queryParams: { hd: 'vertuoza.com' } },
      });
      if (error) throw fail('Google sign-in', error.message);
    },
    async linkGithub() {
      const { error } = await db.auth.linkIdentity({ provider: 'github', options: { redirectTo: callback('link') } });
      if (error) throw fail('GitHub', error.message);
    },
    async save(patch: PlayerPatch, current: Player | null) {
      const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error('Your session ended. Sign in again.');
      return savePlayer(db, workspace, user.id, patch, current);
    },
    async signOut() {
      await db.auth.signOut();
    },
  };
}
