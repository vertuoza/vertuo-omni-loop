// The signed-in player's row of public.player_xp (supabase/migrations/20260926170000_game_room.sql),
// read as them in the workspace the arcade plays: row-level security lets a member read their
// workspace's rows (is_member()), which the game workflow writes at every poll (pnpm game:xp), one
// per lower-cased GitHub login the ledger names, player or not. The demo and the single-file
// artifact have no such row: their guest borrows the demo world's highest XP (`demoXp`).
import { borrowedXp, demoEvents } from '@omni/galaxy';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayerXp, XpRead } from '../arcade/types';

type XpRow = { xp: number; level: number; unlocked: string[] | null };

/** The login's row in the workspace, or null when the workflow has written none for it. */
export async function loadXp(db: Pick<SupabaseClient, 'from'>, workspace: string, login: string): Promise<PlayerXp | null> {
  const { data, error } = await db
    .from('player_xp')
    .select('xp, level, unlocked')
    .eq('workspace_id', workspace)
    .eq('github_login', login.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Supabase: could not read your XP (${error.message})`);
  const row = data as XpRow | null;
  return row ? { xp: Number(row.xp), level: Number(row.level), unlocked: row.unlocked ?? [] } : null;
}

/**
 * The player's XP as the arcade takes it: the row, null for none, or 'unreadable' when the read
 * fails. XP out of reach never takes the galaxy with it: the arcade then shows no level.
 */
export async function readXp(db: Pick<SupabaseClient, 'from'>, workspace: string, login: string): Promise<XpRead> {
  try {
    return await loadXp(db, workspace, login);
  } catch (err) {
    console.error(err);
    return 'unreadable';
  }
}

/**
 * The demo guest's XP: the demo world's highest-XP contributor's, computed from its events by
 * experience(), so the demo shows the game room lit. Null in a world where nobody earned XP.
 */
export function demoXp(now = new Date()): PlayerXp | null {
  const top = borrowedXp(demoEvents(now), { now });
  return top && { xp: top.xp, level: top.level, unlocked: top.unlocked };
}
