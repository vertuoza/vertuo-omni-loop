import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema, ProductPrdIdSchema } from 'omni-loop/kit/lib/ids.ts';
import { HERO_ROLES, HeroRoleSchema } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { qaJobOf, type JobTokens, type QaJob } from './qa';
import type { PlanDecisionRow } from './review';
import type { EventRow, HeroLine, KeptSave } from './room';

// The Operation room's reads (PRD 2842 s8; ADR-0095), on the signed-in person's own client: row-level security
// shows the heroes, missions, events and saves of a workspace to its members and to nobody else. Each answer is
// parsed where it comes in; a failed read throws. No rule lives here: room.service.ts does.

export type RoomDb = Pick<SupabaseClient, 'from'>;

const WHERE = 'missions/room/room.repository';
/** The newest events read: the ledger shows the latest of them. */
const EVENTS_MAX = 200;

const HeroRowSchema = z.object({ id: z.uuid(), name: z.string().min(1), role: HeroRoleSchema, skills: z.array(z.string()) });
const MissionRowSchema = z.object({ id: z.uuid(), title: z.string() });
const EventRowSchema = z.object({
  id: z.uuid(),
  mission_id: z.uuid(),
  at: z.string(),
  role: z.enum([...HERO_ROLES, 'supervisor']),
  actor: z.string().min(1),
  kind: z.string(),
  prd: PrdNumberSchema.nullable(),
  job_id: z.uuid().nullable(),
  link: z.string().nullable(),
  sentence: z.string(),
});
const TokensSchema = z.object({ input: z.number().int().min(0), output: z.number().int().min(0), cacheRead: z.number().int().min(0), cacheWrite: z.number().int().min(0) });
const TokenRowSchema = z.object({ id: z.uuid(), tokens: TokensSchema.nullable().catch(null) });
const QaRowSchema = z.object({ mission_id: z.uuid(), mission_key: z.string().nullable(), log_tail: z.string().nullable() });
const DecisionRowSchema = z.object({
  mission_id: z.uuid(),
  product_prd: ProductPrdIdSchema,
  kind: z.enum(['plan', 'tech']),
  outcome: z.enum(['approved', 'escalated']),
  plan: z.string().nullable(),
  settled: z.array(z.string()),
  why: z.array(z.string()),
  decided_at: z.string(),
});
const SaveRowSchema = z.object({ bytes: z.number(), keep_until: z.string() });

export function roomRepository(db: RoomDb) {
  return {

    /** An AI fleet's heroes, in the order the fleet keeps them. */
    async heroes(workspace: string, fleet: string): Promise<HeroLine[]> {
      const { data, error } = await db.from('virtual_heroes').select('id, name, role, skills').eq('workspace_id', workspace).eq('fleet', fleet).order('position');
      if (error) throw new Error(`Supabase: could not read the heroes (${error.message})`);
      return orThrow(parseRows(HeroRowSchema, data, `${WHERE}: virtual_heroes`));
    },

    /** The fleet's missions, newest first. */
    async missions(workspace: string, fleet: string): Promise<{ id: string; title: string }[]> {
      const { data, error } = await db.from('missions').select('id, title').eq('workspace_id', workspace).eq('fleet', fleet).order('updated_at', { ascending: false });
      if (error) throw new Error(`Supabase: could not read the missions (${error.message})`);
      return orThrow(parseRows(MissionRowSchema, data, `${WHERE}: missions`));
    },

    /** These missions' events, newest first. */
    async events(missions: readonly string[]): Promise<EventRow[]> {
      if (missions.length === 0) return [];
      const { data, error } = await db.from('mission_events').select('id, mission_id, at, role, actor, kind, prd, job_id, link, sentence').in('mission_id', [...missions]).order('at', { ascending: false }).limit(EVENTS_MAX);
      if (error) throw new Error(`Supabase: could not read the room's events (${error.message})`);
      return orThrow(parseRows(EventRowSchema, data, `${WHERE}: mission_events`)).map((row) => ({
        id: row.id, mission: row.mission_id, at: row.at, role: row.role, actor: row.actor, kind: row.kind, prd: row.prd, job: row.job_id, link: row.link, sentence: row.sentence,
      }));
    },

    /** What these jobs spent (PRD 3001): their tokens by job, null for a job whose agent gave none. */
    async tokens(jobs: readonly string[]): Promise<Map<string, JobTokens | null>> {
      if (jobs.length === 0) return new Map();
      const { data, error } = await db.from('runner_jobs').select('id, tokens').in('id', [...new Set(jobs)]);
      if (error) throw new Error(`Supabase: could not read the jobs' tokens (${error.message})`);
      return new Map(orThrow(parseRows(TokenRowSchema, data, `${WHERE}: runner_jobs`)).map((row) => [row.id, row.tokens]));
    },

    /** The QA jobs of these missions that run now (PRD 3001): their PRD, their round, whether they wait for the preview. */
    async qaJobs(missions: readonly string[]): Promise<QaJob[]> {
      if (missions.length === 0) return [];
      const { data, error } = await db.from('runner_jobs').select('mission_id, mission_key, log_tail').in('mission_id', [...missions]).in('status', ['claimed', 'running']).like('mission_key', '%:qa:_');
      if (error) throw new Error(`Supabase: could not read the QA jobs (${error.message})`);
      return orThrow(parseRows(QaRowSchema, data, `${WHERE}: runner_jobs`)).flatMap((row) => qaJobOf({ mission: row.mission_id, key: row.mission_key, logTail: row.log_tail ?? '' }) ?? []);
    },

    /** These missions' plan and tech decisions (PRD omni-loop-26), oldest first: the PM's plan approvals and the Architect's reviews. */
    async decisions(missions: readonly string[]): Promise<PlanDecisionRow[]> {
      if (missions.length === 0) return [];
      const { data, error } = await db.from('mission_decisions').select('mission_id, product_prd, kind, outcome, plan, settled, why, decided_at').in('mission_id', [...missions]).in('kind', ['plan', 'tech']).order('decided_at', { ascending: true });
      if (error) throw new Error(`Supabase: could not read the plan and tech decisions (${error.message})`);
      return orThrow(parseRows(DecisionRowSchema, data, `${WHERE}: mission_decisions`)).map((row) => ({
        mission: row.mission_id, prd: row.product_prd, kind: row.kind, outcome: row.outcome, plan: row.plan, settled: row.settled, why: row.why, at: row.decided_at,
      }));
    },

    /** The saves a workspace's runners still keep (PRD 2809): not deleted, not past their day. */
    async kept(workspace: string, now: Date): Promise<KeptSave[]> {
      const { data, error } = await db.from('runner_checkpoints').select('bytes, keep_until').eq('workspace_id', workspace).is('deleted_at', null).gt('keep_until', now.toISOString());
      if (error) throw new Error(`Supabase: could not read the kept saves (${error.message})`);
      return orThrow(parseRows(SaveRowSchema, data, `${WHERE}: runner_checkpoints`)).map((row) => ({ bytes: row.bytes, keepUntil: row.keep_until }));
    },
  };
}

export type RoomRepository = ReturnType<typeof roomRepository>;
