import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { MissionLevelSchema, MissionStatusSchema } from '../missions.contract';
import type { EventRow, MissionRow } from './missions-tab';

// The Missions tab's reads (PRD 2842 s7; ADR-0095), on the signed-in person's own client: row-level security
// shows a mission and its events to the members of its workspace and to nobody else. Each answer is parsed
// where it comes in; a failed read throws. No rule lives here: missions-tab.service.ts does.

export type MissionsTabDb = Pick<SupabaseClient, 'from'>;

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
  mandate: z.object({ level: MissionLevelSchema.optional() }).loose(),
});
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
        inPlan: plans.has(row.repo.toLowerCase()),
      }));
    },

    /** The PRD events of these missions (ready, merged, waiting, sent), newest first. */
    async events(missions: readonly string[]): Promise<EventRow[]> {
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
