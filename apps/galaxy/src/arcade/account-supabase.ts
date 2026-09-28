// The production account: GitHub sign-in through Supabase Auth (PRD 359), the player's row
// through the database, in the workspace the page plays (src/data/players.ts), with row-level
// security deciding what they may change (their name, fleet and hero; never their GitHub login,
// which comes from the linked identity), and refusing a row to a visitor who has not linked GitHub.
// A finished game's score goes through submit_score(), and the crew's tables are read as the member
// (src/data/scores.ts).
import { createBrowserClient } from '@supabase/ssr';
import { savePlayer } from '../data/players';
import { githubSignIn } from '../data/sign-in-github';
import { loadScores, submitScore } from '../data/scores';
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
      // The callback joins the workspaces of the person's GitHub orgs and links GitHub (src/data/sign-in.ts).
      const { error } = await db.auth.signInWithOAuth(githubSignIn(callback()));
      if (error) throw fail('GitHub sign-in', error.message);
    },
    async linkGithub() {
      // Every sign-in is GitHub's and links it: the arcade's link step signs in again, and the
      // callback answers the linked login (until the step goes, PRD 359 s3).
      const { error } = await db.auth.signInWithOAuth(githubSignIn(callback('link')));
      if (error) throw fail('GitHub', error.message);
    },
    async save(patch: PlayerPatch, current: Player | null) {
      const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error('Your session ended. Sign in again.');
      return savePlayer(db, workspace, user.id, patch, current);
    },
    async submitScore(game: string, score: number) {
      return submitScore(db, workspace, game, score);
    },
    async scores(game: string) {
      if (!workspace) throw new Error('This account belongs to no workspace yet.');
      const { data: { user } } = await db.auth.getUser();
      return loadScores(db, workspace, game, user?.id ?? null);
    },
    async signOut() {
      // This browser only: the default, global, would also end the sign-in `omni signin` keeps for
      // ask mode, and every terminal would quietly fall back to asking itself.
      await db.auth.signOut({ scope: 'local' });
    },
  };
}
