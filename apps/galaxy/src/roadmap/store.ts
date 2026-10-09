// The roadmaps (supabase/migrations/20261110090000_roadmaps.sql, PRD 1162): one row per roadmap and one
// per PRD of it, written as the caller through roadmap_push(), which files a roadmap in the workspace
// its repository belongs to for the caller and replaces its document, questions and PRD rows on every
// later push; and one per prerequisite of it (20261114090000_roadmap_prerequisites.sql, PRD 1218),
// replaced with the last result through roadmap_prerequisites_push() by a push that carries them. A
// member of the workspace reads them all; row-level security decides, so a roadmap of another
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

/** The four kinds of human work (PRD 1217): a product or business choice, a developer's decision, a
 * right missing in the repository, a step toward production. */
export const HUMAN_WORK_KINDS = ['business', 'development', 'dev-ops', 'delivery-ops'] as const;
export const HumanWorkKind = z.enum(HUMAN_WORK_KINDS);
export type HumanWorkKind = z.infer<typeof HumanWorkKind>;

/** Where a piece of human work was read: a person question of roadmap.md, an outbox item, a park line,
 * a needs-clarification comment. Each entry's key starts with its source. */
export const HUMAN_WORK_SOURCES = ['question', 'outbox', 'park', 'clarification'] as const;
export const HumanWorkSource = z.enum(HUMAN_WORK_SOURCES);
export type HumanWorkSource = z.infer<typeof HumanWorkSource>;

/** A key of human work: its source, then what it is within the roadmap (`outbox:1213/s2-01`). */
export const HumanWorkKey = z.string().regex(/^(question|outbox|park|clarification):[A-Za-z0-9._/-]{1,100}$/, 'a key such as outbox:7/s2-01');

/** One piece of human work as `omni roadmap push` sends it, with the kind its rules gave it. */
export type HumanWorkPush = {
  key: string; prd: PrdNumber | null; repo: string; source: HumanWorkSource; text: string; act: string | null; url: string | null;
  ruleKind: HumanWorkKind;
};

/** One PRD of a pushed roadmap, as roadmap_push() takes it. */
export type RoadmapPrdPush = {
  id: string; prd: PrdNumber; title: string; repos: string[]; blockers: string[]; wave: number; state: RoadmapPrdState;
  waitsOn: string | null; waitsOnUrl: string | null; startedAt: string | null; endedAt: string | null;
};

/** Where a prerequisite holds (PRD 1218): the machine, a registry, a grant, GitHub, a service. */
export const PREREQUISITE_CATEGORIES = ['local', 'access', 'permissions', 'github', 'services'] as const;
export const PrerequisiteCategory = z.enum(PREREQUISITE_CATEGORIES);

/** Who does a prerequisite: the agent checks and fixes it, the agent checks it and a person fixes it,
 * or a person ticks it. */
export const PREREQUISITE_WHO = ['agent', 'check', 'person'] as const;
export const PrerequisiteWho = z.enum(PREREQUISITE_WHO);

/** What the last check found of a prerequisite: `waits` is on a person. */
export const PREREQUISITE_STATES = ['ok', 'fixed', 'waits', 'ticked'] as const;
export const PrerequisiteState = z.enum(PREREQUISITE_STATES);
export type PrerequisiteState = z.infer<typeof PrerequisiteState>;

/** A prerequisite's author card, as stored: its four lines, a line it does not write null. */
export const PrerequisiteCard = z.strictObject({
  why: z.string().nullable(),
  command: z.string().nullable(),
  whatItDoes: z.string().nullable(),
  whoCanDoIt: z.string().nullable(),
});
export type PrerequisiteCard = z.infer<typeof PrerequisiteCard>;

/** One prerequisite of a pushed roadmap, as roadmap_prerequisites_push() takes it. */
export type RoadmapPrerequisitePush = {
  id: string; category: z.infer<typeof PrerequisiteCategory>; need: string; check: string | null; fix: string | null;
  blocks: 'all' | string[]; who: z.infer<typeof PrerequisiteWho>; repos: string[]; card: PrerequisiteCard | null;
};

/** The last prerequisites result a push carries: the machine, the time, and each row's state. */
export type RoadmapPrerequisiteResultPush = {
  machine: string; checkedAt: string; rows: Array<{ id: string; state: PrerequisiteState; detail: string | null }>;
};

/** One push of `omni roadmap push`, validated: what roadmap_push() takes, and the prerequisites
 * roadmap_prerequisites_push() takes after it. `humanWork` missing (a kit before PRD 1217) leaves the
 * stored human work as it is; `prerequisites` missing (a kit before PRD 1218) leaves the stored
 * prerequisites as they are. */
export type RoadmapPush = {
  repo: string; roadmap: IssueNumber; title: string; milestone: string; product: string | null; target: string | null;
  source: string | null; questions: RoadmapQuestion[]; document: string; prds: RoadmapPrdPush[]; humanWork?: HumanWorkPush[] | undefined;
  prerequisites?: RoadmapPrerequisitePush[] | undefined; prerequisiteResult?: RoadmapPrerequisiteResultPush | null | undefined;
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
  // Where and when the last prerequisites result was found (PRD 1218): always read
  // (ROADMAP_READ_COLUMNS); optional so a roadmap built before it (the page's demo) still parses.
  prerequisites_machine: z.string().nullable().optional(),
  prerequisites_checked_at: z.string().nullable().optional(),
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

/** A stored piece of human work (PRD 1217): its kind, who chose it (`rule` the kit's rules, `jev` Jev),
 * and whether it is open or done since `done_at`. */
export const RoadmapHumanWorkRow = z.strictObject({
  roadmap_id: z.string(),
  key: z.string(),
  prd: PrdNumberSchema.nullable(),
  repo: z.string(),
  source: HumanWorkSource,
  text: z.string(),
  act: z.string().nullable(),
  url: z.string().nullable(),
  kind: HumanWorkKind,
  kind_by: z.enum(['jev', 'rule']),
  state: z.enum(['open', 'done']),
  first_seen_at: z.string(),
  done_at: z.string().nullable(),
});
export type RoadmapHumanWorkRow = z.infer<typeof RoadmapHumanWorkRow>;

/** One prerequisite of a roadmap, as stored (supabase/migrations/20261114090000_roadmap_prerequisites.sql). */
export const RoadmapPrerequisiteRow = z.strictObject({
  roadmap_id: z.string(),
  position: z.number().int(),
  row_id: z.string(),
  category: PrerequisiteCategory,
  need: z.string(),
  check_with: z.string().nullable(),
  fix_with: z.string().nullable(),
  blocks_all: z.boolean(),
  blocks: z.array(z.string()),
  who: PrerequisiteWho,
  repos: z.array(z.string()),
  card: PrerequisiteCard.nullable(),
  state: PrerequisiteState.nullable(),
  detail: z.string().nullable(),
});
export type RoadmapPrerequisiteRow = z.infer<typeof RoadmapPrerequisiteRow>;

export const ROADMAP_COLUMNS = 'id, workspace_id, repo, number, title, milestone, product_id, target_date, source, questions, document, pushed_by, created_at, pushed_at';
/** The columns 20261114090000_roadmap_prerequisites.sql adds to a roadmap. */
export const ROADMAP_ADDED_COLUMNS = 'prerequisites_machine, prerequisites_checked_at';
export const ROADMAP_READ_COLUMNS = `${ROADMAP_COLUMNS}, ${ROADMAP_ADDED_COLUMNS}`;
export const ROADMAP_PRD_COLUMNS = 'roadmap_id, position, row_id, prd, title, repos, blockers, wave, state, waits_on, waits_on_url, started_at, ended_at';
export const ROADMAP_PREREQUISITE_COLUMNS = 'roadmap_id, position, row_id, category, need, check_with, fix_with, blocks_all, blocks, who, repos, card, state, detail';
export const ROADMAP_HUMAN_WORK_COLUMNS = 'roadmap_id, key, prd, repo, source, text, act, url, kind, kind_by, state, first_seen_at, done_at';

type Failure = { code?: string; message: string };

/** The database refused or failed; `code` is Postgres's: 42501 a repository no workspace of the caller
 * owns, 22023 a malformed argument. */
export class RoadmapStoreError extends StoreError {
  constructor(what: string, failure: Failure) {
    super(what, failure.code, failure.message);
  }
}

/** The body roadmap_push() reads: the push without its prerequisites, its roadmap's number under
 * `number`, and no `humanWork` when the push carried none, so that push closes nothing. */
function bodyOf(push: RoadmapPush): Record<string, unknown> {
  const { repo, roadmap, title, milestone, product, target, source, questions, document, prds, humanWork } = push;
  return { repo, number: roadmap, title, milestone, product, target, source, questions, document, prds, ...(humanWork === undefined ? {} : { humanWork }) };
}

/** The body roadmap_prerequisites_push() reads: the roadmap, its prerequisites and the result. */
function prerequisitesBodyOf(push: RoadmapPush, prerequisites: RoadmapPrerequisitePush[]): Record<string, unknown> {
  return { repo: push.repo, number: push.roadmap, prerequisites, result: push.prerequisiteResult ?? null };
}

/** roadmap_push()'s answer, parsed; its refusal or an answer that does not parse, thrown. */
function settled({ data, error }: { data: unknown; error: Failure | null }): RoadmapPushAnswer {
  if (error) throw new RoadmapStoreError('push the roadmap', error);
  const parsed = parseRow(PushAnswer, data, 'roadmap/store: roadmap_push');
  if (!parsed.ok) throw new RoadmapStoreError('push the roadmap', { message: parsed.error });
  return parsed.value;
}

/** roadmap_prerequisites_push()'s refusal, thrown; its answer is not needed. */
function prerequisitesSettled({ error }: { error: Failure | null }): void {
  if (error) throw new RoadmapStoreError('store the roadmap\'s prerequisites', error);
}

export function roadmapStore(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** Records one push of a roadmap, then its prerequisites when it carries them; answers the
     * roadmap, whether it is new, and its product. */
    async push(push: RoadmapPush): Promise<RoadmapPushAnswer> {
      const answer = settled(await db.rpc('roadmap_push', { p_body: bodyOf(push) }));
      if (push.prerequisites !== undefined) {
        prerequisitesSettled(await db.rpc('roadmap_prerequisites_push', { p_body: prerequisitesBodyOf(push, push.prerequisites) }));
      }
      return answer;
    },
  };
}

/** Reads the roadmaps a member may see: a failed read is no rows (null for one roadmap), logged once. */
export function roadmapReader(db: Pick<SupabaseClient, 'from'>) {
  return {
    /** Every roadmap of the caller's workspaces, the most recently pushed first. */
    async list(): Promise<RoadmapRow[]> {
      const { data, error } = await db.from('roadmaps').select(ROADMAP_READ_COLUMNS).order('pushed_at', { ascending: false });
      return error ? [] : orEmpty(parseRows(RoadmapRow, data, 'roadmap/store: roadmaps'));
    },

    /** One roadmap, or null when it does not exist or is another workspace's. */
    async roadmap(id: string): Promise<RoadmapRow | null> {
      const { data, error } = await db.from('roadmaps').select(ROADMAP_READ_COLUMNS).eq('id', id).maybeSingle();
      return error ? null : orNull(parseRow(RoadmapRow.nullable(), data, 'roadmap/store: roadmaps'));
    },

    /** A roadmap's PRDs, in its table's order. */
    async prds(roadmapId: string): Promise<RoadmapPrdRow[]> {
      const { data, error } = await db.from('roadmap_prds').select(ROADMAP_PRD_COLUMNS).eq('roadmap_id', roadmapId).order('position', { ascending: true });
      return error ? [] : orEmpty(parseRows(RoadmapPrdRow, data, 'roadmap/store: roadmap_prds'));
    },

    /** A roadmap's prerequisites, in its table's order, each with the last result's state. */
    async prerequisites(roadmapId: string): Promise<RoadmapPrerequisiteRow[]> {
      const { data, error } = await db.from('roadmap_prerequisites').select(ROADMAP_PREREQUISITE_COLUMNS).eq('roadmap_id', roadmapId).order('position', { ascending: true });
      return error ? [] : orEmpty(parseRows(RoadmapPrerequisiteRow, data, 'roadmap/store: roadmap_prerequisites'));
    },

    /** A roadmap's human work (PRD 1217): the open first, each part in the order it was first seen. */
    async humanWork(roadmapId: string): Promise<RoadmapHumanWorkRow[]> {
      const { data, error } = await db.from('roadmap_human_work').select(ROADMAP_HUMAN_WORK_COLUMNS).eq('roadmap_id', roadmapId)
        .order('first_seen_at', { ascending: true });
      const rows = error ? [] : orEmpty(parseRows(RoadmapHumanWorkRow, data, 'roadmap/store: roadmap_human_work'));
      return [...rows.filter((h) => h.state === 'open'), ...rows.filter((h) => h.state === 'done')];
    },
  };
}
