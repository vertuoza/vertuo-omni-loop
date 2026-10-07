import 'server-only';
import type { Hero } from '@omni/design';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Player, XpRead } from '../../arcade/types';
import { linkedLogin } from '../../dashboard/you';
import { loadMe } from '../../data/load-galaxy';
import { memberWorkspace, type Workspace } from '../../data/workspace';
import { readXp } from '../../data/xp';
import type { DockPlayer } from '../../play-dock/dock';
import type { Database } from '../../../../../supabase/database.types';

// Who plays in the /ask tab's play dock (PRD 757), read on the server as the signed-in person, exactly
// as the arcade reads them (src/data/arcade.ts): the workspace the arcade plays (the one they joined
// first), their player row there for the hero and the fleet, and, with GitHub linked, their XP row by
// login. The arcade's door decides from that who plays (play-dock/dock.ts); a score goes to that
// workspace's crew table, as it does from the arcade. Nothing here fails the page: out of reach, the
// dock shows no level rather than guess one, and the door refuses.

/** What the /ask page hands its play dock: who plays, drawn how, and where their score is saved. */
export interface AskDock {
  player: DockPlayer;
  hero: Hero | null;
  team: string | null;
  workspace: string | null;
  supabase: { url: string; key: string };
}

/** The reads the dock makes, each as the arcade makes it (a test's seam). */
export interface DockReads {
  workspace: (userId: string) => Promise<Pick<Workspace, 'id'> | null>;
  me: (workspace: string, userId: string) => Promise<Player | null>;
  xp: (workspace: string, login: string) => Promise<XpRead>;
}

const liveReads = (db: SupabaseClient<Database>): DockReads => ({
  workspace: (userId) => memberWorkspace(db, userId),
  me: (workspace, userId) => loadMe(db, workspace, userId),
  xp: (workspace, login) => readXp(db, workspace, login),
});

export async function readAskDock(db: SupabaseClient<Database>, user: User, supabase: AskDock['supabase'], reads: DockReads = liveReads(db)): Promise<AskDock> {
  const linked = linkedLogin(user);
  const none = { hero: null, team: null, workspace: null, supabase };
  try {
    const workspace = await reads.workspace(user.id);
    if (!workspace) return { player: { linked: Boolean(linked), xp: null }, ...none };
    const me = await reads.me(workspace.id, user.id);
    const login = me?.github_login ?? linked;
    const xp = login ? await reads.xp(workspace.id, login) : null;
    return { player: { linked: Boolean(login), xp }, hero: me?.hero ?? null, team: me?.team ?? null, workspace: workspace.id, supabase };
  } catch (error) {
    console.error(error);
    return { player: { linked: Boolean(linked), xp: 'unreadable' }, ...none };
  }
}
