// The notebook job's store (PRD 3107 s4, ./notebook-run.ts), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):
// the App has no person's session. It reads the missions of AI Fleets, their events, the notebooks' lines that are not
// deleted and the fleet's spending, and writes a batch of lines to commander_notes
// (supabase/migrations/20270128092000_commander_notes.sql), whose trigger refuses a line citing no event of its mission. A
// batch already written (the unique batch index, 23505) writes nothing. Throws when the database refuses or answers out of
// shape: the job's run fails, and the worker retries it.
import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { NoteEvent, NoteMission } from './notebook.ts';
import type { NotebookStore, NotebookRow } from './notebook-run.ts';

/** The columns each read selects, shared with ./notebook.boundary.ts. */
export const NOTE_MISSION = 'id, workspace_id, fleet, number, title, status, teams!inner(kind)';
export const NOTE_EVENT = 'id, at, role, kind, prd, sentence';
export const NOTE_LINE = 'line';
export const NOTE_BATCH = 'id';
export const NOTE_CAP = 'daily_tokens';

export const NoteMissionRowSchema = z.object({
  id: z.uuid(), workspace_id: z.uuid(), fleet: z.string().min(1), number: z.number().int().positive(), title: z.string(), status: z.string(),
  teams: z.object({ kind: z.string() }),
});
export const NoteEventRowSchema = z.object({ id: z.uuid(), at: z.string(), role: z.string(), kind: z.string(), prd: PrdNumberSchema.nullable(), sentence: z.string() });
export const NoteLineRowSchema = z.object({ line: z.string() });
export const NoteBatchRowSchema = z.object({ id: z.uuid() });
export const NoteCapRowSchema = z.object({ daily_tokens: z.number().int().positive().nullable() });
/** What fleet_tokens_24h() answers: a bigint, which PostgREST may give as a number or its text. */
const SpentRowSchema = z.object({ tokens: z.coerce.number().int().min(0) });

const missionOf = (row: z.infer<typeof NoteMissionRowSchema>): NoteMission => ({
  id: row.id, workspace: row.workspace_id, fleet: row.fleet, number: row.number, title: row.title, status: row.status,
});

/** The store, as the service role on `connection`. */
export function notebookStore(connection: Connection): NotebookStore {
  const db = serviceDb(connection);
  const virtual = (rows: z.infer<typeof NoteMissionRowSchema>[]) => rows.filter((row) => row.teams.kind === 'virtual').map(missionOf);
  return {
    async active() {
      return virtual(rowsOf(NoteMissionRowSchema, await db.from('missions').select(NOTE_MISSION).in('status', ['running', 'waiting', 'paused']).eq('teams.kind', 'virtual').order('id').limit(500)));
    },

    async ended(since) {
      return virtual(rowsOf(NoteMissionRowSchema, await db.from('missions').select(NOTE_MISSION).in('status', ['delivered', 'stopped']).gte('updated_at', since).eq('teams.kind', 'virtual').order('id').limit(500)));
    },

    async events(mission, { from, to, limit }) {
      let query = db.from('mission_events').select(NOTE_EVENT).eq('mission_id', mission);
      if (from !== null) query = query.gte('at', from);
      if (to !== null) query = query.lt('at', to);
      const rows = rowsOf(NoteEventRowSchema, await query.order('at', { ascending: false }).limit(limit));
      return rows.reverse().map((e): NoteEvent => ({ id: e.id, at: e.at, role: e.role, kind: e.kind, prd: e.prd, sentence: e.sentence }));
    },

    async lines(of, limit) {
      const base = db.from('commander_notes').select(NOTE_LINE).eq('notebook', of.notebook).is('deleted_at', null);
      const query = of.notebook === 'mission' ? base.eq('mission_id', of.mission) : base.eq('workspace_id', of.workspace).eq('fleet', of.fleet);
      return rowsOf(NoteLineRowSchema, await query.order('created_at', { ascending: false }).limit(limit)).map((row) => row.line);
    },

    async written({ notebook, mission, day }) {
      const base = db.from('commander_notes').select(NOTE_BATCH).eq('notebook', notebook).eq('mission_id', mission);
      return rowsOf(NoteBatchRowSchema, await (day === null ? base : base.eq('day', day)).limit(1)).length > 0;
    },

    async over(workspace, fleet, at) {
      const [team] = rowsOf(NoteCapRowSchema, await db.from('teams').select(NOTE_CAP).eq('workspace_id', workspace).eq('name', fleet).limit(1));
      if (!team?.daily_tokens) return false;
      const [spent] = rowsOf(SpentRowSchema, await db.rpc('fleet_tokens_24h', { p_workspace: workspace, p_fleet: fleet, p_at: at.toISOString() }));
      return (spent?.tokens ?? 0) >= team.daily_tokens;
    },

    async write(rows: readonly NotebookRow[]) {
      if (rows.length === 0) return 0;
      const answer = await db.from('commander_notes').insert(rows.map((row) => ({
        workspace_id: row.workspace, fleet: row.fleet, notebook: row.notebook, mission_id: row.mission, day: row.day, place: row.place, line: row.line, events: row.events,
      }))).select(NOTE_BATCH);
      if (answer.error?.code === '23505') return 0;
      return rowsOf(NoteBatchRowSchema, answer).length;
    },
  };
}
