import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRows } from '../data/parse-rows';
import { MissionStatusSchema } from './missions.contract';
import type { RepairEvent, RepairFacts, RepairRow } from './repair';

// What the Operation room and the Missions tab read to say a PRD repairs (PRD 2980 s6), on the signed-in person's own client: the
// repairs a mission kept, its repair events and its status. The Omni Loop bug table is the App's alone, so the issue a PRD waits on
// is read from its `bug-reported` event's link. A failed read throws. The rules live in ./repair.ts.

export type RepairDb = Pick<SupabaseClient, 'from'>;

const WHERE = 'missions/repair.repository';
const KINDS = ['repair-started', 'retro', 'repair-ended', 'bug-reported', 'stopped', 'prd-ready', 'prd-merged'];
const EVENTS_MAX = 1000;

const RowSchema = z.object({
  mission_id: z.string(),
  prd: PrdNumberSchema,
  fingerprint: z.string(),
  round: z.number(),
  number: z.number(),
  job_id: z.string().nullable(),
  fix_pr: z.string().nullable(),
  outcome: z.enum(['fixed', 'not fixed', 'stopped', 'lost']).nullable(),
  started_at: z.string(),
  retro: z.looseObject({ cause: z.string(), class: z.string(), proposedFix: z.string() }).nullable().catch(null),
});
const EventSchema = z.object({ mission_id: z.string(), kind: z.string(), prd: PrdNumberSchema.nullable(), job_id: z.string().nullable(), link: z.string().nullable(), at: z.string() });
const StatusSchema = z.object({ id: z.string(), status: MissionStatusSchema });

export function repairRepository(db: RepairDb) {
  return {
    /** The facts the repair lines of these missions are read from. */
    async facts(missions: readonly string[]): Promise<RepairFacts> {
      if (missions.length === 0) return { rows: [], events: [], statuses: new Map() };
      const ids = [...missions];
      const rows = await db.from('mission_repairs').select('mission_id, prd, fingerprint, round, number, job_id, fix_pr, outcome, started_at, retro').in('mission_id', ids);
      if (rows.error) throw new Error(`Supabase: could not read the missions' repairs (${rows.error.message})`);
      const events = await db.from('mission_events').select('mission_id, kind, prd, job_id, link, at').in('mission_id', ids).in('kind', KINDS).order('at', { ascending: false }).limit(EVENTS_MAX);
      if (events.error) throw new Error(`Supabase: could not read the missions' repair events (${events.error.message})`);
      const status = await db.from('missions').select('id, status').in('id', ids);
      if (status.error) throw new Error(`Supabase: could not read the missions' status (${status.error.message})`);
      return {
        rows: orThrow(parseRows(RowSchema, rows.data, `${WHERE}: mission_repairs`)).map((row): RepairRow => ({
          mission: row.mission_id, prd: row.prd, fingerprint: row.fingerprint, round: row.round, number: row.number, job: row.job_id, fixPr: row.fix_pr, outcome: row.outcome, startedAt: row.started_at, retro: row.retro,
        })),
        events: orThrow(parseRows(EventSchema, events.data, `${WHERE}: mission_events`)).map((row): RepairEvent => ({ mission: row.mission_id, kind: row.kind, prd: row.prd, job: row.job_id, link: row.link, at: row.at })),
        statuses: new Map(orThrow(parseRows(StatusSchema, status.data, `${WHERE}: missions`)).map((row) => [row.id, row.status])),
      };
    },
  };
}

export type RepairRepository = ReturnType<typeof repairRepository>;
