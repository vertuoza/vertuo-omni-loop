// The loops (supabase/migrations/20261108090000_loops.sql, PRD 1139): one row per `/omni:drive` loop,
// its ledger and every version of its plan, written as the caller through loop_push(), which opens a
// loop only for its caller, in the workspace the repository belongs to for them, and pushes only to the
// caller's own loop. A member of the workspace reads all three; row-level security decides, so a loop of
// another workspace reads as missing. Every answer is parsed where it comes in (data/parse-rows.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { OutboxItemIdSchema, PrdNumberSchema, PrNumberSchema, type OutboxItemId, type PrdNumber, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { orEmpty, orNull, parseRow, parseRows } from '../data/parse-rows';

/** A plan as the kit computed it: an object the app stores and shows, never reshapes. */
export type LoopPlan = Record<string, unknown>;

/** One push of `omni loop push`, validated: what loop_push() takes. */
export type LoopEvent =
  | { event: 'start'; repo: string; prds: PrdNumber[]; plan: LoopPlan; reason?: string | undefined; takeOver: boolean }
  | {
    event: 'tick'; loopId: string; step: number; steps: number; prd: PrdNumber; action: string; result: string;
    link: string | null; merged: PrNumber[]; items: OutboxItemId[]; nextWakeAt: string | null;
    replan?: { reason: string; plan: LoopPlan } | undefined;
  }
  | { event: 'park'; loopId: string; prd: PrdNumber; who: string; what: string; link: string | null }
  | { event: 'stop'; loopId: string };

const StoredState = z.enum(['running', 'parked', 'stopped']);

/** What loop_push() answers: the loop, its stored state and its plan's latest version. */
const PushAnswer = z.strictObject({ loopId: z.string(), state: StoredState, planVersion: z.number().int() });
type PushAnswer = z.infer<typeof PushAnswer>;

/** A PRD parked on a person, as the loop keeps it. */
const ParkedPrd = z.strictObject({ prd: PrdNumberSchema, who: z.string(), what: z.string(), link: z.string().nullable(), at: z.string() });

export const LoopRow = z.strictObject({
  id: z.string(),
  user_id: z.string(),
  workspace_id: z.string(),
  repo: z.string(),
  prds: z.array(PrdNumberSchema),
  state: StoredState,
  parked: z.array(ParkedPrd),
  started_at: z.string(),
  seen_at: z.string(),
  last_tick_at: z.string().nullable(),
  next_wake_at: z.string().nullable(),
  stopped_at: z.string().nullable(),
});
type LoopRow = z.infer<typeof LoopRow>;

export const TickRow = z.strictObject({
  id: z.number().int(),
  loop_id: z.string(),
  at: z.string(),
  step: z.number().int(),
  steps: z.number().int(),
  prd: PrdNumberSchema,
  action: z.string(),
  result: z.string(),
  link: z.string().nullable(),
  merged: z.array(PrNumberSchema),
  items: z.array(OutboxItemIdSchema),
  next_wake_at: z.string().nullable(),
});
type TickRow = z.infer<typeof TickRow>;

export const PlanRow = z.strictObject({
  loop_id: z.string(),
  version: z.number().int(),
  reason: z.string(),
  plan: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
type PlanRow = z.infer<typeof PlanRow>;

export const LOOP_COLUMNS = 'id, user_id, workspace_id, repo, prds, state, parked, started_at, seen_at, last_tick_at, next_wake_at, stopped_at';
export const TICK_COLUMNS = 'id, loop_id, at, step, steps, prd, action, result, link, merged, items, next_wake_at';
export const PLAN_COLUMNS = 'loop_id, version, reason, plan, created_at';

type Failure = { code?: string; message: string };

/** The database refused or failed; `code` is Postgres's: 42501 another account's loop or a repository
 * no workspace of the caller owns, P0002 no such loop, 55000 a loop already running or stopped, 22023
 * a malformed argument. */
export class LoopStoreError extends Error {
  readonly code: string | undefined;
  readonly reason: string;

  constructor(what: string, failure: Failure) {
    super(`${what}: ${failure.message}`);
    this.code = failure.code;
    this.reason = failure.message;
  }
}

/** The fields loop_push() reads from its body, for one event: everything but the event and the loop. */
function bodyOf(event: LoopEvent): Record<string, unknown> {
  switch (event.event) {
    case 'start': {
      const { repo, prds, plan, reason, takeOver } = event;
      return { repo, prds, plan, ...(reason === undefined ? {} : { reason }), takeOver };
    }
    case 'tick': {
      const { step, steps, prd, action, result, link, merged, items, nextWakeAt, replan } = event;
      return { step, steps, prd, action, result, link, merged, items, nextWakeAt, ...(replan ? { replan } : {}) };
    }
    case 'park': {
      const { prd, who, what, link } = event;
      return { prd, who, what, link };
    }
    case 'stop':
      return {};
  }
}

/** loop_push()'s answer, parsed; its refusal or an answer that does not parse, thrown. */
function settled(what: string, { data, error }: { data: unknown; error: Failure | null }): PushAnswer {
  if (error) throw new LoopStoreError(what, error);
  const parsed = parseRow(PushAnswer, data, 'loop/store: loop_push');
  if (!parsed.ok) throw new LoopStoreError(what, { message: parsed.error });
  return parsed.value;
}

export function loopStore(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** Records one push of the caller's loop; answers the loop, its stored state and plan version. */
    async push(event: LoopEvent): Promise<PushAnswer> {
      return settled(`push the loop's ${event.event}`, await db.rpc('loop_push', {
        p_event: event.event,
        p_loop: event.event === 'start' ? null : event.loopId,
        p_body: bodyOf(event),
      }));
    },
  };
}

/** Reads the loops a member may see: a failed read is no rows (null for one loop), logged once. */
export function loopReader(db: Pick<SupabaseClient, 'from'>) {
  return {
    /** Every loop of the caller's workspaces, the most recently pushed first. */
    async list(): Promise<LoopRow[]> {
      const { data, error } = await db.from('loops').select(LOOP_COLUMNS).order('seen_at', { ascending: false });
      return error ? [] : orEmpty(parseRows(LoopRow, data, 'loop/store: loops'));
    },

    /** One loop, or null when it does not exist or is another workspace's. */
    async loop(id: string): Promise<LoopRow | null> {
      const { data, error } = await db.from('loops').select(LOOP_COLUMNS).eq('id', id).maybeSingle();
      return error ? null : orNull(parseRow(LoopRow.nullable(), data, 'loop/store: loops'));
    },

    /** A loop's ledger, oldest tick first. */
    async ticks(loopId: string): Promise<TickRow[]> {
      const { data, error } = await db.from('loop_ticks').select(TICK_COLUMNS).eq('loop_id', loopId).order('id', { ascending: true });
      return error ? [] : orEmpty(parseRows(TickRow, data, 'loop/store: loop_ticks'));
    },

    /** Every version of a loop's plan, the first first. */
    async plans(loopId: string): Promise<PlanRow[]> {
      const { data, error } = await db.from('loop_plans').select(PLAN_COLUMNS).eq('loop_id', loopId).order('version', { ascending: true });
      return error ? [] : orEmpty(parseRows(PlanRow, data, 'loop/store: loop_plans'));
    },
  };
}
