import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema, ProductPrdIdSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRow, parseRows } from '../../data/parse-rows';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { MissionLevelSchema, MissionStatusSchema } from '../missions.contract';
import type { OpenStop, TabEvent, MissionRow } from './missions-tab';
import type { ItemRow, RetroRow } from './retros';

// The Missions tab's reads (PRD 2842 s7; ADR-0095), on the signed-in person's own client: row-level security
// shows a mission and its events to the members of its workspace and to nobody else. Each answer is parsed
// where it comes in; a failed read throws. No rule lives here: missions-tab.service.ts does.

export type MissionsTabDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const WHERE = 'missions/page/missions-tab.repository';
const MISSION = 'id, repo, number, title, goal, status, waiting_on, scope, mandate, paused_by, kind';
/** The newest requests read: a request whose mission is not pushed yet is one of the last few presses. */
const REQUESTS_MAX = 20;
// A product PRD's events name its id in `product_prd`, `prd` left null (20270129100000_mission_product_prd.sql).
const EVENT = 'mission_id, kind, prd, product_prd, link, sentence';
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
  // `stuck` while the supervisor holds the mission paused by stuck (PRD 3065).
  paused_by: z.enum(['stuck']).nullable().default(null),
  kind: z.string().default('prds'),
  // A PRD of the scope is a repository PRD's number or a product PRD's id (omni-loop-28), as the brief takes it (#3320).
  scope: z.object({ prds: z.array(z.union([PrdNumberSchema, ProductPrdIdSchema])), roadmaps: z.array(z.unknown()).default([]) }).loose(),
  products: z.object({ prds: z.array(z.unknown()).default([]), roadmaps: z.array(z.unknown()).default([]) }).nullish(),
  // A mission made before PRD 2896 holds no level: it reads `with-you`.
  mandate: z.object({ level: MissionLevelSchema.optional(), tokens: z.number().int().positive().optional() }).loose(),
});
const CapRow = z.object({ daily_tokens: z.number().int().positive().nullable() });
// A level it cannot read reads `with-you`, the one that asks the most of a person.
const LevelRow = z.object({ level: MissionLevelSchema.catch('with-you') });
const RequestRowSchema = z.object({ id: z.uuid(), goal: z.string() });
const StopRowSchema = z.object({ id: z.uuid(), cap: z.enum(['mission', 'fleet']), cap_tokens: z.number().int().positive(), spent: z.number().int().nonnegative(), missions: z.array(z.uuid()) });
const SpentRow = z.object({ tokens: z.number().int().nonnegative() });
const ProductRowSchema = z.object({ plan_repository: z.string().nullable() });
const CitedSchema = z.object({ text: z.string(), cites: z.array(z.object({ kind: z.enum(['event', 'prd', 'pr', 'repair']), ref: z.number().int().positive() })) });
const RetroRowSchema = z.object({
  id: z.uuid(), mission_id: z.uuid(), milestone: z.string(), file: z.string().nullable(), skipped: z.string().nullable(), created_at: z.string(),
  // A retro the page cannot read whole reads as not written, never as done (BL-GATE-1).
  retro: z.object({ wentWell: z.array(CitedSchema), toChange: z.array(CitedSchema) }).nullable().catch(null),
});
const ItemRowSchema = z.object({
  id: z.uuid(), mission_id: z.uuid(), target: z.string(), wording: z.string(), evidence: z.array(z.string()).catch([]), answer: z.enum(['adopted', 'declined']).nullable(),
  note: z.string().nullable(), answered_by: z.uuid().nullable(), created_at: z.string(),
});
const PlayerRow = z.object({ user_id: z.uuid(), display_name: z.string().min(1) });
const EventRowSchema = z.object({ mission_id: z.uuid(), kind: z.string(), prd: PrdNumberSchema.nullable(), product_prd: ProductPrdIdSchema.nullable().default(null), link: z.string().nullable(), sentence: z.string() });
const PlanDecisionRowSchema = z.object({ mission_id: z.uuid(), outcome: z.string() });

/** The plan repositories of a workspace's live products, in lower case (PRD 2896 s14). */
async function planRepositories(db: MissionsTabDb, workspace: string): Promise<Set<string>> {
  const products = await db.from('products').select('plan_repository').eq('workspace_id', workspace).is('archived_at', null);
  if (products.error) throw new Error(`Supabase: could not read the products (${products.error.message})`);
  const plans = new Set<string>();
  for (const product of orThrow(parseRows(ProductRowSchema, products.data, `${WHERE}: products`))) {
    if (product.plan_repository !== null) plans.add(product.plan_repository.toLowerCase());
  }
  return plans;
}

/** Whether a mission is goal-only (PRD omni-loop-24): it runs at `alone` and its scope names no PRD and no roadmap, a product's neither. */
function goalOnlyOf(row: z.infer<typeof MissionRowSchema>): boolean {
  const named = row.scope.prds.length + row.scope.roadmaps.length + (row.products?.prds.length ?? 0) + (row.products?.roadmaps.length ?? 0);
  return row.kind !== 'omni-bugs' && (row.mandate.level ?? 'with-you') === 'alone' && named === 0;
}

export function missionsTabRepository(db: MissionsTabDb) {
  return {

    /** An AI fleet's missions, the most recently moved first. */
    async missions(workspace: string, fleet: string): Promise<MissionRow[]> {
      const { data, error } = await db.from('missions').select(MISSION).eq('workspace_id', workspace).eq('fleet', fleet).order('updated_at', { ascending: false });
      if (error) throw new Error(`Supabase: could not read the missions (${error.message})`);
      const plans = await planRepositories(db, workspace);
      // A mission row it cannot read is logged and left out (#3320): it never takes every other mission of the fleet down.
      const rows = orThrow(parseRows(z.unknown(), data, `${WHERE}: missions`)).flatMap((one) => {
        const parsed = parseRow(MissionRowSchema, one, `${WHERE}: missions`);
        return parsed.ok ? [parsed.value] : [];
      });
      return rows.map((row) => ({
        id: row.id, repo: row.repo, number: row.number, title: row.title, goal: row.goal, status: row.status, waitingOn: row.waiting_on, prds: row.scope.prds, level: row.mandate.level ?? 'with-you', goalOnly: goalOnlyOf(row),
        inPlan: plans.has(row.repo.toLowerCase()), tokens: row.mandate.tokens ?? null, pausedBy: row.paused_by,
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

    /** The fleet's own level (teams.level): the box starts a mission only for an owner, or on a fleet at Works alone (PRD omni-loop-24). */
    async fleetLevel(workspace: string, fleet: string): Promise<MissionLevel> {
      const { data, error } = await db.from('teams').select('level').eq('workspace_id', workspace).eq('name', fleet).maybeSingle();
      if (error) throw new Error(`Supabase: could not read the fleet's level (${error.message})`);
      return data === null ? 'with-you' : orThrow(parseRow(LevelRow, data, `${WHERE}: teams`)).level;
    },

    /** The presses of Start whose mission is not pushed yet, newest first (PRD omni-loop-24): the page says `Writing the mission`. */
    async requests(workspace: string, fleet: string): Promise<{ id: string; goal: string }[]> {
      const { data, error } = await db.from('mission_requests').select('id, goal').eq('workspace_id', workspace).eq('fleet_key', fleet).is('mission_number', null).order('created_at', { ascending: false }).limit(REQUESTS_MAX);
      if (error) throw new Error(`Supabase: could not read the mission requests (${error.message})`);
      return orThrow(parseRows(RequestRowSchema, data, `${WHERE}: mission_requests`)).map((row) => ({ id: row.id, goal: row.goal }));
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

    /** The milestone retros of these missions (PRD 3065), oldest first: written, or skipped with why. */
    async retros(missions: readonly string[]): Promise<RetroRow[]> {
      if (missions.length === 0) return [];
      const { data, error } = await db.from('mission_retros').select('id, mission_id, milestone, retro, file, skipped, created_at').in('mission_id', [...missions]).order('created_at', { ascending: true });
      if (error) throw new Error(`Supabase: could not read the missions' retros (${error.message})`);
      return orThrow(parseRows(RetroRowSchema, data, `${WHERE}: mission_retros`)).map((row) => ({ id: row.id, mission: row.mission_id, milestone: row.milestone, retro: row.retro, skipped: row.skipped, file: row.file, at: row.created_at }));
    },

    /** The questions of these missions' own outbox (PRD 3065), oldest first, each answered one with the name of who answered. */
    async items(missions: readonly string[]): Promise<ItemRow[]> {
      if (missions.length === 0) return [];
      const { data, error } = await db.from('mission_items').select('id, mission_id, target, wording, evidence, answer, note, answered_by, created_at').in('mission_id', [...missions]).order('created_at', { ascending: true });
      if (error) throw new Error(`Supabase: could not read the missions' questions (${error.message})`);
      const rows = orThrow(parseRows(ItemRowSchema, data, `${WHERE}: mission_items`));
      const people = [...new Set(rows.flatMap((row) => (row.answered_by === null ? [] : [row.answered_by])))];
      const names = new Map<string, string>();
      if (people.length > 0) {
        const read = await db.from('players').select('user_id, display_name').in('user_id', people);
        // A name that cannot be read leaves the card saying `a member` answered: it never takes the page down.
        if (!read.error) for (const player of orThrow(parseRows(PlayerRow, read.data, `${WHERE}: players`))) names.set(player.user_id, player.display_name);
      }
      return rows.map((row) => ({ id: row.id, mission: row.mission_id, target: row.target, wording: row.wording, evidence: row.evidence, answer: row.answer, note: row.note, answeredBy: row.answered_by === null ? null : (names.get(row.answered_by) ?? null), at: row.created_at }));
    },

    /** The PRD events of these missions (ready, merged, waiting, sent), a product PRD's too, newest first. */
    async events(missions: readonly string[]): Promise<TabEvent[]> {
      if (missions.length === 0) return [];
      // A row the PM's cap left unwritten (PRD 2896 s12) names no PRD, and is read too.
      const read = await db.from('mission_events').select(EVENT).in('mission_id', [...missions]).or('prd.not.is.null,product_prd.not.is.null,kind.eq.not-written').order('at', { ascending: false }).limit(EVENTS_MAX);
      if (read.error) throw new Error(`Supabase: could not read the missions' events (${read.error.message})`);
      const rows = orThrow(parseRows(EventRowSchema, read.data, `${WHERE}: mission_events`));
      return rows.map(({ mission_id: mission, prd, product_prd: product, ...rest }) => ({ mission, prd: product ?? prd, ...rest }));
    },

    /** How many `plan` and `tech` decisions the fleet approved on each mission's product PRDs (PRD omni-loop-26); an escalated one went to a person. */
    async planDecisions(missions: readonly string[]): Promise<Map<string, number>> {
      const counts = new Map<string, number>();
      if (missions.length === 0) return counts;
      const { data, error } = await db.from('mission_decisions').select('mission_id, outcome').in('mission_id', [...missions]).in('kind', ['plan', 'tech']);
      if (error) throw new Error(`Supabase: could not read the plan and tech decisions (${error.message})`);
      for (const row of orThrow(parseRows(PlanDecisionRowSchema, data, `${WHERE}: mission_decisions`))) {
        if (row.outcome === 'approved') counts.set(row.mission_id, (counts.get(row.mission_id) ?? 0) + 1);
      }
      return counts;
    },
  };
}

export type MissionsTabRepository = ReturnType<typeof missionsTabRepository>;
