import type { SupabaseClient } from '@supabase/supabase-js';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { z } from 'zod';
import { orThrow, parseRow, parseRows } from '../data/parse-rows';
import { MissionLevelSchema, MissionStatusSchema, type MissionStatus } from './missions.contract';

// The missions' reads and writes (PRD 2842 s5), on the clients they are given. A signed-in person reads
// through their own session, so row-level security shows a mission to the members of its workspace and to
// nobody else; only the service role writes (supabase/migrations/20270122093000_missions.sql): it moves a
// mission, records its event and adds or refreshes its job on the App's ledger (`background_job_refresh`).
// Each answer is parsed where it comes in; a failed read or write throws. No rule lives here.

export type MissionsDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const WHERE = 'missions/missions.repository';
const MISSION = 'id, workspace_id, repo, status, number, title, mandate';

const MissionRow = z.object({
  id: z.uuid(), workspace_id: z.uuid(), repo: z.string().min(1), status: MissionStatusSchema,
  number: z.number().int().positive(), title: z.string(),
  // A mission made before PRD 2896 holds no level: it reads `with-you`.
  mandate: z.object({ level: MissionLevelSchema.optional() }).loose(),
});
/** A mission as the repository reads it: its workspace, its repository, where it stands and the level it runs at. */
export type MissionRecord = { id: string; workspace: string; repo: string; status: MissionStatus; number: number; title: string; level: MissionLevel };

const toRecord = (row: z.infer<typeof MissionRow>): MissionRecord =>
  ({ id: row.id, workspace: row.workspace_id, repo: row.repo, status: row.status, number: row.number, title: row.title, level: row.mandate.level ?? 'with-you' });

/** The job a mission keeps on the App's ledger: its kind, key, subject and lane, due at once (mirrors apps/omni-app/src/missions/job.ts). */
export type MissionJob = { kind: 'mission'; key: string; subject: string; payload: { mission: string }; lane: string; delaySeconds: 0 };

/** The job of mission `id` in repository `repo`: `background_job_refresh` adds it, brings a queued one forward or queues a finished one again. */
export const missionJob = (id: string, repo: string): MissionJob =>
  ({ kind: 'mission', key: `mission:${id}`, subject: repo.toLowerCase(), payload: { mission: id }, lane: `mission:${id}`, delaySeconds: 0 });

const JoinRow = z.object({ kind: z.enum(['prd-joined', 'prd-dropped', 'landed']), prd: PrdNumberSchema });
const Refreshed = z.enum(['added', 'updated', 'again', 'requeued']);

async function readOne(db: MissionsDb, id: string): Promise<MissionRecord | null> {
  const { data, error } = await db.from('missions').select(MISSION).eq('id', id).maybeSingle();
  if (error) throw new Error(`Supabase: could not read the mission (${error.message})`);
  return data === null ? null : toRecord(orThrow(parseRow(MissionRow, data, `${WHERE}: missions`)));
}

/** What a signed-in person reads: the missions their workspace membership shows. */
export function missionsReader(db: MissionsDb) {
  return {
    /** The mission, or null when it is none or the person may not see it. */
    mission: (id: string): Promise<MissionRecord | null> => readOne(db, id),

    /** How many PRDs sit on the mission's branch: those whose latest join event is not followed by a drop or a landing. */
    async joined(id: string): Promise<number> {
      const { data, error } = await db.from('mission_events').select('kind, prd').eq('mission_id', id).in('kind', ['prd-joined', 'prd-dropped', 'landed']).not('prd', 'is', null).order('at', { ascending: true });
      if (error) throw new Error(`Supabase: could not read the mission's events (${error.message})`);
      const on = new Set<PrdNumber>();
      for (const row of orThrow(parseRows(JoinRow, data, `${WHERE}: mission_events`))) {
        if (row.kind === 'prd-joined') on.add(row.prd);
        else on.delete(row.prd);
      }
      return on.size;
    },

    /** Sets the mission's level as the signed-in person, so the database decides who may raise it: the level, or the database's refusal in its words. */
    async setLevel(id: string, level: MissionLevel): Promise<{ ok: true; level: MissionLevel } | { ok: false; forbidden: boolean; error: string }> {
      const answer: { data: unknown; error: { message: string; code?: string } | null } = await db.rpc('set_mission_level', { p_mission: id, p_level: level });
      if (answer.error) return { ok: false, forbidden: answer.error.code === '42501', error: answer.error.message };
      const done = orThrow(parseRow(MissionRow, answer.data, `${WHERE}: set_mission_level`));
      return { ok: true, level: done.mandate.level ?? 'with-you' };
    },
  };
}
export type MissionsReader = ReturnType<typeof missionsReader>;

/** What the service role reads and writes for a move and the supervisor's wakes. */
export function missionsWriter(db: MissionsDb) {
  return {
    /** The mission, as the service role reads it, or null. */
    mission: (id: string): Promise<MissionRecord | null> => readOne(db, id),

    /** The missions of a repository that run, wait or are paused: the ones a stage change or an answer may wake. */
    async watching(repo: string): Promise<MissionRecord[]> {
      const { data, error } = await db.from('missions').select(MISSION).eq('repo', repo.toLowerCase()).in('status', ['running', 'waiting', 'paused']);
      if (error) throw new Error(`Supabase: could not read the missions of ${repo} (${error.message})`);
      return orThrow(parseRows(MissionRow, data, `${WHERE}: missions`)).map(toRecord);
    },

    /** Moves the mission from one of `from` to `to`, due at `at`; whether it was still there to move (a Pause landing meanwhile is never overwritten). */
    async move(id: string, from: readonly MissionStatus[], to: MissionStatus, change: { at: string; startedBy: string | null }): Promise<boolean> {
      const patch = { status: to, next_wake_at: change.at, updated_at: change.at, ...(change.startedBy === null ? {} : { started_by: change.startedBy }) };
      const { data, error } = await db.from('missions').update(patch).eq('id', id).in('status', [...from]).select('id');
      if (error) throw new Error(`Supabase: could not move the mission (${error.message})`);
      return Array.isArray(data) && data.length > 0;
    },

    /** Records one event of the mission, signed with the member's login. */
    async event(id: string, event: { kind: 'started' | 'paused' | 'resumed'; actor: string; sentence: string; at: string }): Promise<void> {
      const { error } = await db.from('mission_events').insert({ mission_id: id, at: event.at, role: 'supervisor', actor: event.actor, kind: event.kind, sentence: event.sentence });
      if (error) throw new Error(`Supabase: could not record the mission's event (${error.message})`);
    },

    /** Adds or refreshes the mission's job on the ledger, due at once. */
    async refresh(job: MissionJob): Promise<void> {
      const answer: { data: unknown; error: { message: string } | null } = await db.rpc('background_job_refresh', {
        p_kind: job.kind, p_key: job.key, p_subject: job.subject, p_payload: job.payload, p_delay_seconds: job.delaySeconds, p_lane: job.lane,
      });
      if (answer.error) throw new Error(`Supabase: could not refresh the mission's job (${answer.error.message})`);
      Refreshed.parse(answer.data);
    },
  };
}
export type MissionsWriter = ReturnType<typeof missionsWriter>;
