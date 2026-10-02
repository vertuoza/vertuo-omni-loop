// A player's row in public.players: one per workspace and person (workspace_id, user_id). Read and
// written as the person, so row-level security decides: a member reads their workspace's players,
// and one with GitHub linked creates or changes only their own row, and only its name, fleet and
// hero (never their GitHub login, which the database copies from the linked identity). The arcade
// calls the person's id `id`: it is the row's `user_id`.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Player, PlayerPatch } from '../arcade/types';

export const PLAYER_COLUMNS = 'id:user_id, display_name, team, team_since, hero, github_login';

/** Creates the person's player row in the workspace (joining a fleet), or changes it; resolves with
 * the row as stored. */
export async function savePlayer(
  db: Pick<SupabaseClient, 'from'>, workspace: string | null, userId: string, patch: PlayerPatch, current: Player | null,
): Promise<Player> {
  if (!workspace) throw new Error('This account belongs to no workspace yet.');
  const query = current
    ? db.from('players').update(patch).eq('workspace_id', workspace).eq('user_id', userId)
    : db.from('players').insert({ workspace_id: workspace, user_id: userId, ...patch });
  const { data, error } = await query.select(PLAYER_COLUMNS).single();
  // A visitor's row is refused by row-level security: joining a fleet needs GitHub linked.
  if (error && !current && error.code === '42501') throw new Error('Link your GitHub first: it is what makes you a player.');
  if (error) throw new Error(`Saving: ${error.message}`);
  return data;
}
