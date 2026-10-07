// The roadmaps (supabase/migrations/20261109090000_roadmaps.sql, PRD 1162): one row per roadmap and one
// per PRD of it, written as the caller through roadmap_push(), which files a roadmap in the workspace
// its repository belongs to for the caller and replaces its document, questions and PRD rows on every
// later push. A member of the workspace reads both; row-level security decides, so a roadmap of another
// workspace reads as missing. Every answer is parsed where it comes in (data/parse-rows.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema, type IssueNumber, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { orEmpty, orNull, parseRow, parseRows } from '../data/parse-rows';
import { StoreError } from '../data/store-error';

/** Where a roadmap's PRD stands: its bar's colour on the Gantt. `ready` waits for a person's merge;
 * `closed` is a feature PR closed unmerged. */
export const ROADMAP_PRD_STATES = ['waiting', 'building', 'outbox', 'ready', 'merged', 'closed'] as const;
export const RoadmapPrdState = z.enum(ROADMAP_PRD_STATES);
export type RoadmapPrdState = z.infer<typeof RoadmapPrdState>;

/** A row id of roadmap.md (P1.1) or a question's (Q5). */
export const RowIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$/, 'an id such as P1.1 or Q5');

/** An open question of a roadmap, as it is pushed and stored: a `person` one parks what it blocks
 * until `answer` is set. */
export const RoadmapQuestion = z.strictObject({
  id: RowIdSchema,
  question: z.string().trim().min(1).max(500),
  recommendation: z.string().trim().min(1).max(500).nullable().default(null),
  blocks: z.array(RowIdSchema).max(50),
  kind: z.enum(['default', 'person']),
  answer: z.string().trim().min(1).max(1000).nullable().default(null),
});
export type RoadmapQuestion = z.infer<typeof RoadmapQuestion>;

/** One PRD of a pushed roadmap, as roadmap_push() takes it. */
export type RoadmapPrdPush = {
  id: string; prd: PrdNumber; title: string; repos: string[]; blockers: string[]; wave: number; state: RoadmapPrdState;
  waitsOn: string | null; waitsOnUrl: string | null; startedAt: string | null; endedAt: string | null;
};

/** One push of `omni roadmap push`, validated: what roadmap_push() takes. */
export type RoadmapPush = {
  repo: string; roadmap: IssueNumber; title: string; milestone: string; product: string | null; target: string | null;
  source: string | null; questions: RoadmapQuestion[]; document: string; prds: RoadmapPrdPush[];
};

/** What roadmap_push() answers: the roadmap, whether this push created it, the product it was filed
 * under, and the product named that matched none of the workspace's. */
const PushAnswer = z.strictObject({
  roadmapId: z.string(),
  created: z.boolean(),
  product: z.string().nullable(),
  unknownProduct: z.string().nullable(),
});
export type RoadmapPushAnswer = z.infer<typeof PushAnswer>;

export const RoadmapRow = z.strictObject({
  id: z.string(),
  workspace_id: z.string(),
  repo: z.string(),
  number: IssueNumberSchema,
  title: z.string(),
  milestone: z.string(),
  product_id: z.string().nullable(),
  target_date: z.string().nullable(),
  source: z.string().nullable(),
  questions: z.array(RoadmapQuestion),
  document: z.string(),
  pushed_by: z.string().nullable(),
  created_at: z.string(),
  pushed_at: z.string(),
});
export type RoadmapRow = z.infer<typeof RoadmapRow>;

export const RoadmapPrdRow = z.strictObject({
  roadmap_id: z.string(),
  position: z.number().int(),
  row_id: z.string(),
  prd: PrdNumberSchema,
  title: z.string(),
  repos: z.array(z.string()),
  blockers: z.array(z.string()),
  wave: z.number().int(),
  state: RoadmapPrdState,
  waits_on: z.string().nullable(),
  waits_on_url: z.string().nullable(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
});
export type RoadmapPrdRow = z.infer<typeof RoadmapPrdRow>;

export const ROADMAP_COLUMNS = 'id, workspace_id, repo, number, title, milestone, product_id, target_date, source, questions, document, pushed_by, created_at, pushed_at';
export const ROADMAP_PRD_COLUMNS = 'roadmap_id, position, row_id, prd, title, repos, blockers, wave, state, waits_on, waits_on_url, started_at, ended_at';

type Failure = { code?: string; message: string };

/** The database refused or failed; `code` is Postgres's: 42501 a repository no workspace of the caller
 * owns, 22023 a malformed argument. */
export class RoadmapStoreError extends StoreError {
  constructor(what: string, failure: Failure) {
    super(what, failure.code, failure.message);
  }
}

/** The body roadmap_push() reads: the push, its roadmap's number under `number`. */
function bodyOf(push: RoadmapPush): Record<string, unknown> {
  const { roadmap, ...rest } = push;
  return { ...rest, number: roadmap };
}

/** roadmap_push()'s answer, parsed; its refusal or an answer that does not parse, thrown. */
function settled({ data, error }: { data: unknown; error: Failure | null }): RoadmapPushAnswer {
  if (error) throw new RoadmapStoreError('push the roadmap', error);
  const parsed = parseRow(PushAnswer, data, 'roadmap/store: roadmap_push');
  if (!parsed.ok) throw new RoadmapStoreError('push the roadmap', { message: parsed.error });
  return parsed.value;
}

export function roadmapStore(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** Records one push of a roadmap; answers the roadmap, whether it is new, and its product. */
    async push(push: RoadmapPush): Promise<RoadmapPushAnswer> {
      return settled(await db.rpc('roadmap_push', { p_body: bodyOf(push) }));
    },
  };
}

/** Reads the roadmaps a member may see: a failed read is no rows (null for one roadmap), logged once. */
export function roadmapReader(db: Pick<SupabaseClient, 'from'>) {
  return {
    /** Every roadmap of the caller's workspaces, the most recently pushed first. */
    async list(): Promise<RoadmapRow[]> {
      const { data, error } = await db.from('roadmaps').select(ROADMAP_COLUMNS).order('pushed_at', { ascending: false });
      return error ? [] : orEmpty(parseRows(RoadmapRow, data, 'roadmap/store: roadmaps'));
    },

    /** One roadmap, or null when it does not exist or is another workspace's. */
    async roadmap(id: string): Promise<RoadmapRow | null> {
      const { data, error } = await db.from('roadmaps').select(ROADMAP_COLUMNS).eq('id', id).maybeSingle();
      return error ? null : orNull(parseRow(RoadmapRow.nullable(), data, 'roadmap/store: roadmaps'));
    },

    /** A roadmap's PRDs, in its table's order. */
    async prds(roadmapId: string): Promise<RoadmapPrdRow[]> {
      const { data, error } = await db.from('roadmap_prds').select(ROADMAP_PRD_COLUMNS).eq('roadmap_id', roadmapId).order('position', { ascending: true });
      return error ? [] : orEmpty(parseRows(RoadmapPrdRow, data, 'roadmap/store: roadmap_prds'));
    },
  };
}
