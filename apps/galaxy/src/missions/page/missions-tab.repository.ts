import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRow, parseRows } from '../../data/parse-rows';
import { MissionLevelSchema, MissionStatusSchema } from '../missions.contract';
import type { OpenStop, TabEvent, MissionRow } from './missions-tab';

// The Missions tab's reads (PRD 2842 s7; ADR-0095), on the signed-in person's own client: row-level security
// shows a mission and its events to the members of its workspace and to nobody else. Each answer is parsed
// where it comes in; a failed read throws. No rule lives here: missions-tab.service.ts does.

export type MissionsTabDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const WHERE = 'missions/page/missions-tab.repository';
const MISSION = 'id, repo, number, title, goal, status, waiting_on, scope, mandate';
const EVENT = 'mission_id, kind, prd, link, sentence';
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
  // A mission made before PRD 2896 holds no level: it reads `with-you`.
  mandate: z.object({ level: MissionLevelSchema.optional(), tokens: z.number().int().positive().optional() }).loose(),
});
const CapRow = z.object({ daily_tokens: z.number().int().positive().nullable() });
const StopRowSchema = z.object({ id: z.uuid(), cap: z.enum(['mission', 'fleet']), cap_tokens: z.number().int().positive(), spent: z.number().int().nonnegative(), missions: z.array(z.uuid()) });
const SpentRow = z.object({ tokens: z.number().int().nonnegative() });
const ProductRowSchema = z.object({ plan_repository: z.string().nullable() });
const EventRowSchema = z.object({ mission_id: z.uuid(), kind: z.string(), prd: PrdNumberSchema.nullable(), link: z.string().nullable(), sentence: z.string() });

export function missionsTabRepository(db: MissionsTabDb) {
  return {

    /** A virtual fleet's missions, the most recently moved first. */
    async missions(workspace: string, fleet: string): Promise<MissionRow[]> {
      const { data, error } = await db.from('missions').select(MISSION).eq('workspace_id', workspace).eq('fleet', fleet).order('updated_at', { ascending: false });
      if (error) throw new Error(`Supabase: could not read the missions (${error.message})`);
      const products = await db.from('products').select('plan_repository').eq('workspace_id', workspace).is('archived_at', null);
      if (products.error) throw new Error(`Supabase: could not read the products (${products.error.message})`);
      const plans = new Set(orThrow(parseRows(ProductRowSchema, products.data, `${WHERE}: products`)).flatMap((product) => product.plan_repository === null ? [] : [product.plan_repository.toLowerCase()]));
      return orThrow(parseRows(MissionRowSchema, data, `${WHERE}: missions`)).map((row) => ({
        id: row.id, repo: row.repo, number: row.number, title: row.title, goal: row.goal, status: row.status, waitingOn: row.waiting_on, prds: row.scope.prds, level: row.mandate.level ?? 'with-you',
        inPlan: plans.has(row.repo.toLowerCase()), tokens: row.mandate.tokens ?? null,
      }));
    },

    /** Whether the person owns the workspace (is_owner()): only then is the fleet's cap theirs to change (PRD 3040). */
    async owner(workspace: string): Promise<boolean> {
      const answer: { data: unknown; error: { message: string } | null } = await db.rpc('is_owner', { workspace });
      if (answer.error) throw new Error(`Supabase: could not read your role (${answer.error.message})`);
      return answer.data === true;
    },

    /** The fleet's daily token cap (teams.daily_tokens): null when it has none (PRD 3040). */
    async dailyCap(workspace: string, fleet: string): Promise<number | null> {
      const { data, error } = await db.from('teams').select('daily_tokens').eq('workspace_id', workspace).eq('name', fleet).maybeSingle();
      if (error) throw new Error(`Supabase: could not read the fleet's daily cap (${error.message})`);
      return data === null ? null : orThrow(parseRow(CapRow, data, `${WHERE}: teams`)).daily_tokens;
    },

    /** What the fleet's missions spent in the last 24 hours up to `at` (fleet_tokens_24h(), counted tokens) (PRD 3040). */
    async fleetSpent(workspace: string, fleet: string, at: Date): Promise<number> {
      const answer: { data: unknown; error: { message: string } | null } = await db.rpc('fleet_tokens_24h', { p_workspace: workspace, p_fleet: fleet, p_at: at.toISOString() });
      if (answer.error) throw new Error(`Supabase: could not read the fleet's spending (${answer.error.message})`);
      return orThrow(parseRows(SpentRow, answer.data, `${WHERE}: fleet_tokens_24h`))[0]?.tokens ?? 0;
    },

    /** What each mission spent over every job it sent (mission_tokens(), counted tokens) (PRD 3040). */
    async spent(missions: readonly string[]): Promise<Map<string, number>> {
      const read = await Promise.all(missions.map(async (id) => {
        const answer: { data: unknown; error: { message: string } | null } = await db.rpc('mission_tokens', { p_mission: id });
        if (answer.error) throw new Error(`Supabase: could not read a mission's spending (${answer.error.message})`);
        return [id, z.number().int().nonnegative().parse(answer.data)] as const;
      }));
      return new Map(read);
    },

    /** The fleet's budget stops that wait for an answer (PRD 3040). */
    async openStops(workspace: string, fleet: string): Promise<OpenStop[]> {
      const { data, error } = await db.from('mission_budget_stops').select('id, cap, cap_tokens, spent, missions').eq('workspace_id', workspace).eq('fleet', fleet).is('answer', null);
      if (error) throw new Error(`Supabase: could not read the budget stops (${error.message})`);
      return orThrow(parseRows(StopRowSchema, data, `${WHERE}: mission_budget_stops`)).map((row) => ({ id: row.id, cap: row.cap, capTokens: row.cap_tokens, spent: row.spent, missions: row.missions }));
    },

    /** The PRD events of these missions (ready, merged, waiting, sent), newest first. */
    async events(missions: readonly string[]): Promise<TabEvent[]> {
      if (missions.length === 0) return [];
      // A row the PM's cap left unwritten (PRD 2896 s12) names no PRD, and is read too.
      const read = await db.from('mission_events').select(EVENT).in('mission_id', [...missions]).or('prd.not.is.null,kind.eq.not-written').order('at', { ascending: false }).limit(EVENTS_MAX);
      if (read.error) throw new Error(`Supabase: could not read the missions' events (${read.error.message})`);
      const rows = orThrow(parseRows(EventRowSchema, read.data, `${WHERE}: mission_events`));
      return rows.map(({ mission_id: mission, ...rest }) => ({ mission, ...rest }));
    },
  };
}

export type MissionsTabRepository = ReturnType<typeof missionsTabRepository>;
