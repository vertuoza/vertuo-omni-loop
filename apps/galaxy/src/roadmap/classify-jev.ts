import { z } from 'zod';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { hitlCategory, type HitlInput } from '../jev/decisions/hitl-category';
import { decide, type JevDecideDeps } from '../jev/resolve';
import { HumanWorkKind, HumanWorkSource } from './store';

// The human work's kind through Jev (PRD 1217 s3): once a push has answered, each new key of the roadmap
// is offered, once, to the `hitl-category` decision of the roadmap's workspace, with the kind the kit's
// rules gave it as today's answer. The resolver (../jev/resolve.ts) applies the mode: On, Jev's answer
// among the four kinds, at or above the confidence floor, becomes the kind (`kind_by = 'jev'`); Shadow
// logs it beside the rule kind, which stays; Off asks nothing. A Jev error, or an answer outside the four,
// keeps the rule kind. Never throws: the push has already succeeded, and a failure only leaves a rule kind.
//
// The database (supabase/migrations/20261113100000_hitl_category.sql), as the service role, as every Jev
// decision: roadmap_human_work_claim() hands out up to a batch of keys never offered and marks them
// offered, so no later push offers them again whatever the mode is then; roadmap_human_work_set_kind()
// stores Jev's counted kind. Keys are asked a batch at a time until none is left or the time budget is
// spent; the keys never claimed are offered after the next push.

/** How many keys are asked of Jev at once. */
export const CLASSIFY_BATCH = 5;
/** How long one push's classifying goes on before it leaves the rest for the next push. */
export const CLASSIFY_BUDGET_MS = 6_000;
/** Off asks nothing: every new key of a push (500 at most) is marked offered in one call. */
const OFF_CLAIM = 500;

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

const Claimed = z.object({
  workspace: z.string().min(1).nullable(),
  entries: z.array(z.object({
    key: z.string().min(1),
    prd: PrdNumberSchema.nullable(),
    prdTitle: z.string().nullable(),
    repo: z.string().min(1),
    source: HumanWorkSource,
    text: z.string().min(1),
    act: z.string().nullable(),
    url: z.string().nullable(),
    ruleKind: HumanWorkKind,
  })),
});
type Claimed = z.infer<typeof Claimed>;
type ClaimedEntry = Claimed['entries'][number];

export interface HumanWorkClassifier {
  /** Up to `limit` open keys of the roadmap never offered, now marked offered, and its workspace. */
  claim(roadmapId: string, limit: number): Promise<Claimed>;
  /** Jev's counted kind, on a key offered and still of the rule's kind. */
  setKind(roadmapId: string, key: string, kind: HumanWorkKind): Promise<void>;
  jev: JevDecideDeps;
  now(): number;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

async function call(db: Rpc, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${why(error)}`);
  return data;
}

/** The classifier's dependencies: `db` acts as the service role. */
export function humanWorkClassifier(db: Rpc, jev: JevDecideDeps, now: () => number = Date.now): HumanWorkClassifier {
  return {
    async claim(roadmapId, limit) {
      const read = Claimed.safeParse(await call(db, 'roadmap_human_work_claim', { p_roadmap: roadmapId, p_limit: limit }));
      if (!read.success) throw new Error(`roadmap_human_work_claim answered what it should not (${read.error.issues[0]?.message ?? 'see the schema'})`);
      return read.data;
    },
    async setKind(roadmapId, key, kind) {
      await call(db, 'roadmap_human_work_set_kind', { p_roadmap: roadmapId, p_key: key, p_kind: kind });
    },
    jev,
    now,
  };
}

const inputOf = (entry: ClaimedEntry): HitlInput =>
  ({ source: entry.source, text: entry.text, act: entry.act, repo: entry.repo, prdTitle: entry.prdTitle });

/** One key asked: whether Jev's kind counted and was stored. */
async function classifyOne(deps: HumanWorkClassifier, workspace: string, roadmapId: string, entry: ClaimedEntry): Promise<boolean> {
  try {
    const counted = await decide(deps.jev, {
      workspace, entry: hitlCategory, input: inputOf(entry), old: () => Promise.resolve(entry.ruleKind), ref: entry.url ?? entry.key,
    });
    if (counted.decidedBy !== 'jev' || counted.value === null) return false;
    await deps.setKind(roadmapId, entry.key, counted.value);
    return true;
  } catch (err) {
    console.error(`roadmaps: ${entry.key} keeps its rule kind (${why(err)})`);
    return false;
  }
}

/** What one run did: how many keys it offered, and how many took Jev's kind. */
export interface Classified {
  offered: number;
  byJev: number;
}

/** Offers the roadmap's new keys to `hitl-category`, once each. Never throws. */
export async function classifyHumanWork(deps: HumanWorkClassifier, roadmapId: string): Promise<Classified> {
  const done: Classified = { offered: 0, byJev: 0 };
  try {
    const started = deps.now();
    const first = await deps.claim(roadmapId, CLASSIFY_BATCH);
    const { workspace } = first;
    if (!workspace || first.entries.length === 0) return done;
    const settings = await deps.jev.settings(workspace, hitlCategory.name).catch(() => null);
    if (!settings || settings.mode === 'off') {
      done.offered = first.entries.length + (await deps.claim(roadmapId, OFF_CLAIM)).entries.length;
      return done;
    }
    let batch = first.entries;
    while (batch.length > 0) {
      const counted = await Promise.all(batch.map((entry) => classifyOne(deps, workspace, roadmapId, entry)));
      done.offered += batch.length;
      done.byJev += counted.filter(Boolean).length;
      if (deps.now() - started >= CLASSIFY_BUDGET_MS) break;
      batch = (await deps.claim(roadmapId, CLASSIFY_BATCH)).entries;
    }
    return done;
  } catch (err) {
    console.error(`roadmaps: the human work of roadmap ${roadmapId} keeps its rule kinds (${why(err)})`);
    return done;
  }
}
