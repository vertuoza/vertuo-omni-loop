// The one read of a mission's events (PRD 2842) that the Missions tab and the Operation room share: the
// newest first, at most `max`, for the missions given, and only the rows that name a PRD when asked. Each
// caller parses the rows with its own schema, so this module knows no row's shape.
import type { SupabaseClient } from '@supabase/supabase-js';

export type MissionEventsDb = Pick<SupabaseClient, 'from'>;

/** What a caller reads: its columns, how many rows at most, whether only PRD events, and its name in an error. */
export type MissionEventsRead = { columns: string; max: number; prdOnly: boolean; what: string };

/** The raw rows of these missions' events, newest first; none when no mission is given. */
export async function missionEventRows(db: MissionEventsDb, missions: readonly string[], read: MissionEventsRead): Promise<unknown[]> {
  if (missions.length === 0) return [];
  const query = db.from('mission_events').select(read.columns).in('mission_id', [...missions]);
  const { data, error } = await (read.prdOnly ? query.not('prd', 'is', null) : query).order('at', { ascending: false }).limit(read.max);
  if (error) throw new Error(`Supabase: could not read ${read.what} (${error.message})`);
  return data;
}
