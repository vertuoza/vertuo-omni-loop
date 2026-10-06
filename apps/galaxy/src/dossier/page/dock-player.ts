// Who is at the dossier page, as the play dock needs it (PRD 757, s4): whether GitHub is linked (the
// arcade's rule: linking it makes a visitor a player), their XP in the dossier's workspace (the row the
// game workflow writes, read as the arcade reads it, src/data/xp.ts), and their hero and fleet, drawn
// in the game. Read on the server as the signed-in person, so row-level security decides. A failed
// read never takes the page with it: XP unread is 'unreadable', which the arcade's door refuses in its
// own words; a player row unread draws the default hero.
import type { Hero } from '@omni/design';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { readXp } from '../../data/xp';
import type { DockPlayer } from '../../play-dock/dock';

/** What the page hands the dock about its player: plain data, it crosses to the browser. */
export type DockSetup = { player: DockPlayer; hero: Hero | null; team: string | null; workspace: string };

type Me = { team: string | null; hero: Hero | null; github_login: string | null };

/** The GitHub login linked to this sign-in, if any. */
function githubLogin(user: Pick<User, 'identities'>): string | null {
  const data = user.identities?.find((i) => i.provider === 'github')?.identity_data ?? null;
  const login: unknown = data?.user_name ?? data?.preferred_username;
  return typeof login === 'string' && login ? login : null;
}

/** Their player row in the workspace; null before they have one, or when it cannot be read. */
async function readMe(db: Pick<SupabaseClient, 'from'>, workspace: string, userId: string): Promise<Me | null> {
  const { data, error } = await db.from('players').select('team, hero, github_login').eq('workspace_id', workspace).eq('user_id', userId).maybeSingle();
  if (error) {
    console.error(`Supabase: could not read your player (${error.message})`);
    return null;
  }
  return data ?? null;
}

export async function readDockPlayer(db: Pick<SupabaseClient, 'from'>, user: Pick<User, 'id' | 'identities'>, workspace: string): Promise<DockSetup> {
  const me = await readMe(db, workspace, user.id);
  const login = me?.github_login ?? githubLogin(user);
  const xp = login ? await readXp(db, workspace, login) : null;
  return { player: { linked: login !== null, xp }, hero: me?.hero ?? null, team: me?.team ?? null, workspace };
}
