// The crew's high scores, public.arcade_scores (supabase/migrations/20260926180000_arcade_scores.sql),
// read and written as the signed-in person in the workspace the arcade plays: row-level security lets
// a member read their workspace's scores, and submit_score() is the only way a score goes in (it
// checks the caller is a player there with the game unlocked, holds the score to the cap, and keeps
// the higher of the stored best and the score). The page reads each game's table with the galaxy;
// the Supabase account sends a finished game's score. The demo keeps its own in browser storage.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { GAMES } from '../arcade/games';
import type { ScoreBoard, ScoreLine, ScoresRead } from '../arcade/types';
import { z } from 'zod';
import { orThrow, parseRows } from './parse-rows';
import { StoredHero } from './players';
import { numberOf } from './unparsed';

/** How many lines a cabinet shows: the crew's top five. */
export const TOP = 5;

/** The columns of a line of a game's table: the score, and its player's name, hero and fleet. */
export const SCORE_COLUMNS = 'id:user_id, best, player:players(display_name, hero, team)';

/** A line of a game's table as SCORE_COLUMNS reads it. `best` is read as a number on purpose: PostgREST
 * may send a bigint as text. */
export const ScoreRow = z.strictObject({
  id: z.string(),
  best: z.coerce.number(),
  player: z.strictObject({ display_name: z.string(), hero: StoredHero.nullable(), team: z.string().nullable() }).nullable(),
});
type ScoreRow = z.infer<typeof ScoreRow>;

const lineOf = (row: ScoreRow): ScoreLine => ({
  id: row.id, name: row.player?.display_name ?? '???', hero: row.player?.hero ?? null, team: row.player?.team ?? null, best: numberOf(row.best),
});

/**
 * A game's crew table in the workspace: its top five, best first (the earlier of two equal scores
 * first), each under the player's arcade name and hero; and `userId`'s own best, wherever it ranks.
 */
export async function loadScores(db: Pick<SupabaseClient<Database>, 'from'>, workspace: string, game: string, userId: string | null): Promise<ScoreBoard> {
  const table = () => db.from('arcade_scores');
  const [top, mine] = await Promise.all([
    table()
      .select(SCORE_COLUMNS)
      .eq('workspace_id', workspace)
      .eq('game', game)
      .order('best', { ascending: false })
      .order('at', { ascending: true })
      .limit(TOP),
    userId ? table().select('best').eq('workspace_id', workspace).eq('game', game).eq('user_id', userId).maybeSingle() : null,
  ]);
  const error = top.error ?? mine?.error;
  if (error) throw new Error(`Supabase: could not read the high scores (${error.message})`);
  const own = mine?.data;
  const lines = orThrow(parseRows(ScoreRow, top.data, 'data/scores: arcade_scores'));
  return { top: lines.map(lineOf), mine: own ? numberOf(own.best) : null };
}

/**
 * Every game's crew table, keyed by the game's id in the registry, as the page hands them to the
 * arcade. Each is read on its own: a table out of reach is 'unreadable', and never takes the galaxy
 * or the other tables with it.
 */
export async function readScores(db: Pick<SupabaseClient<Database>, 'from'>, workspace: string, userId: string | null): Promise<Record<string, ScoresRead>> {
  const read = async (game: string): Promise<ScoresRead> => {
    try {
      return await loadScores(db, workspace, game, userId);
    } catch (err) {
      console.error(err);
      return 'unreadable';
    }
  };
  return Object.fromEntries(await Promise.all(GAMES.map(async (g) => [g.id, await read(g.id)] as const)));
}

/** Sends a finished game's score through submit_score(); resolves with the player's best at the game as stored. */
export async function submitScore(db: Pick<SupabaseClient<Database>, 'rpc'>, workspace: string | null, game: string, score: number): Promise<number> {
  if (!workspace) throw new Error('This account belongs to no workspace yet.');
  const { data, error } = await db.rpc('submit_score', { workspace, game, score });
  if (error) throw new Error(`Saving your score: ${error.message}`);
  return numberOf(data);
}
