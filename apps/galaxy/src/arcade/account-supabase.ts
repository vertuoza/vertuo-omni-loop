// The production account: Google sign-in and GitHub linking through Supabase Auth, the player's row
// through the database, with row-level security deciding what they may change (their name, fleet
// and hero; never their GitHub login, which link_github() sets from the linked identity).
import { createBrowserClient } from '@supabase/ssr';
import type { Account, Player, PlayerPatch } from './types';

const COLUMNS = 'id, display_name, team, team_since, hero, github_login';

export function supabaseAccount({ url, key }: { url: string; key: string }): Account {
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
        // hd filters Google's account chooser; the sign-in hook and every policy enforce the domain.
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
      const query = current
        ? db.from('players').update(patch).eq('id', user.id)
        : db.from('players').insert({ id: user.id, ...patch });
      const { data, error } = await query.select(COLUMNS).single();
      if (error) throw fail('Saving', error.message);
      return data as Player;
    },
    async signOut() {
      await db.auth.signOut();
    },
  };
}
