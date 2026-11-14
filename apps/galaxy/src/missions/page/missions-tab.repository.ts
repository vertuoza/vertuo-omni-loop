import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { MissionStatusSchema } from '../missions.contract';
import { missionEventRows } from '../mission-events.repository';
import type { EventRow, MissionRow } from './missions-tab';

// The Missions tab's reads (PRD 2842 s7; ADR-0095), on the signed-in person's own client: row-level security
// shows a mission and its events to the members of its workspace and to nobody else. Each answer is parsed
// where it comes in; a failed read throws. No rule lives here: missions-tab.service.ts does.

export type MissionsTabDb = Pick<SupabaseClient, 'from'>;

const WHERE = 'missions/page/missions-tab.repository';
const MISSION = 'id, repo, number, title, goal, status, waiting_on, scope';
const EVENT = 'mission_id, kind, prd, link';
/** The newest events read: enough to count a mission's PRDs and find what each waits on. */
const EVENTS_MAX = 1000;

const MissionRowSchema = z.object({
  id: z.uuid(),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string(),
  goal: z.string(),
  status: MissionStatusSchema,
  waiting_on: z.string().nullable(),
  scope: z.object({ prds: z.array(PrdNumberSchema) }).loose(),
});
const EventRowSchema = z.object({ mission_id: z.uuid(), kind: z.string(), prd: PrdNumberSchema.nullable(), link: z.string().nullable() });

export function missionsTabRepository(db: MissionsTabDb) {
  return {
    /** A virtual fleet's missions, the most recently moved first. */
    async missions(workspace: string, fleet: string): Promise<MissionRow[]> {
      const { data, error } = await db.from('missions').select(MISSION).eq('workspace_id', workspace).eq('fleet', fleet).order('updated_at', { ascending: false });
      if (error) throw new Error(`Supabase: could not read the missions (${error.message})`);
      return orThrow(parseRows(MissionRowSchema, data, `${WHERE}: missions`)).map((row) => ({
        id: row.id, repo: row.repo, number: row.number, title: row.title, goal: row.goal, status: row.status, waitingOn: row.waiting_on, prds: row.scope.prds,
      }));
    },

    /** The PRD events of these missions (ready, merged, waiting, sent), newest first. */
    async events(missions: readonly string[]): Promise<EventRow[]> {
      const rows = await missionEventRows(db, missions, { columns: EVENT, max: EVENTS_MAX, prdOnly: true, what: "the missions' events" });
      return orThrow(parseRows(EventRowSchema, rows, `${WHERE}: mission_events`)).map((row) => ({ mission: row.mission_id, kind: row.kind, prd: row.prd, link: row.link }));
    },
  };
}

export type MissionsTabRepository = ReturnType<typeof missionsTabRepository>;
