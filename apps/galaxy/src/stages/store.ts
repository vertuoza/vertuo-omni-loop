// The one way into the stored PRD stages (supabase/migrations/20261008090000_prd_stages.sql): public.prd_stages
// and public.prd_topics. The sync and the stage events write, as the service role; the pages read, as
// the signed-in member, so row-level security keeps each workspace's rows to its members.
//
// A PRD is a workspace, a repository and an issue number. A repository is kept in lower case, as a
// dossier's home_repo is. A stage is recorded once: writing it again refreshes when it was last seen
// (synced_at), and the database keeps its first date. A refusal throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentStage, isStoredStage, STORED_STAGES, type StageRow, type StoredStage } from './stage';

export const STAGES_TABLE = 'prd_stages';
export const TOPICS_TABLE = 'prd_topics';

/** A PRD of a workspace: its repository (`owner/name`) and its issue number. */
export type StageKey = { workspace_id: string; repository: string; prd: number };
/** A PRD within a workspace, when the workspace is given apart. */
export type PrdRef = { repository: string; prd: number };
/** A stage seen for a PRD, and when it was reached: the event's own date, or the sync's time. */
export type StageRecord = StageKey & { stage: StoredStage; reached_at: string };
/** The topic of a PRD's folder, `<nnnn>-<topic>`. */
export type TopicRecord = StageKey & { topic: string };
/** How many PRDs sit at each stored stage now. */
export type StageCounts = Record<StoredStage, number>;

export type StageStore = {
  /** Records each stage seen; one already stored keeps its date and is marked seen at `syncedAt`. */
  recordStages(rows: readonly StageRecord[], syncedAt?: string): Promise<void>;
  /** Records the topic of a PRD's folder, replacing the one it had. */
  recordTopic(topic: TopicRecord): Promise<void>;
  /** A PRD's stored stages, in track order. */
  stagesOf(key: StageKey): Promise<StageRow[]>;
  /** The current stage of each PRD of the workspace that has one (of `prds` only, when given), keyed by `prdKey`. */
  currentStages(workspace: string, prds?: readonly PrdRef[]): Promise<Map<string, StoredStage>>;
  /** How many of the workspace's PRDs (of `prds` only, when given) sit at each stage now. */
  stageCounts(workspace: string, prds?: readonly PrdRef[]): Promise<StageCounts>;
  /** The PRD whose folder has this topic in the repository; null when none is known. */
  prdByTopic(workspace: string, repository: string, topic: string): Promise<number | null>;
};

/** A PRD's key within a workspace: `owner/name#7`, the repository in lower case. */
export const prdKey = ({ repository, prd }: PrdRef) => `${repository.toLowerCase()}#${prd}`;

/** No PRD at any stage. */
export const noCounts = (): StageCounts => Object.fromEntries(STORED_STAGES.map((s) => [s, 0])) as StageCounts;

/** Counts the current stages given. */
export function countStages(current: Iterable<StoredStage>): StageCounts {
  const counts = noCounts();
  for (const stage of current) counts[stage] += 1;
  return counts;
}

const byTrack = (a: StageRow, b: StageRow) => STORED_STAGES.indexOf(a.stage) - STORED_STAGES.indexOf(b.stage);

/** The current stage of each PRD among `rows`, kept to `prds` when given. */
export function currentOf(rows: readonly (PrdRef & { stage: StoredStage })[], prds?: readonly PrdRef[]): Map<string, StoredStage> {
  const wanted = prds ? new Set(prds.map(prdKey)) : null;
  const grouped = new Map<string, { stage: StoredStage }[]>();
  for (const row of rows) {
    const key = prdKey(row);
    if (wanted && !wanted.has(key)) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const current = new Map<string, StoredStage>();
  for (const [key, stages] of grouped) {
    const stage = currentStage(stages);
    if (stage) current.set(key, stage);
  }
  return current;
}

/** The project's max_rows (supabase/config.toml): the most rows one read returns. */
const PAGE = 1000;

type Refusal = { message: string; code?: string } | null;

function settle(what: string, error: Refusal): void {
  if (error) throw new Error(`Supabase refused to ${what}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

const lower = (repository: string) => repository.toLowerCase();

function stageRows(data: unknown): StageRow[] {
  return ((data ?? []) as Record<string, unknown>[])
    .filter((row) => isStoredStage(row.stage))
    .map((row) => ({ stage: row.stage as StoredStage, reached_at: String(row.reached_at), synced_at: String(row.synced_at) }))
    .sort(byTrack);
}

export function stageStore(db: Pick<SupabaseClient, 'from'>): StageStore {
  const store: StageStore = {
    async recordStages(rows, syncedAt = new Date().toISOString()) {
      if (rows.length === 0) return;
      const values = rows.map((r) => ({
        workspace_id: r.workspace_id, repository: lower(r.repository), prd: r.prd, stage: r.stage, reached_at: r.reached_at, synced_at: syncedAt,
      }));
      const { error } = await db.from(STAGES_TABLE).upsert(values, { onConflict: 'workspace_id,repository,prd,stage' });
      settle(`record ${rows.length} ${rows.length === 1 ? 'stage' : 'stages'}`, error);
    },

    async recordTopic({ workspace_id, repository, prd, topic }) {
      const { error } = await db.from(TOPICS_TABLE)
        .upsert({ workspace_id, repository: lower(repository), prd, topic }, { onConflict: 'workspace_id,repository,prd' });
      settle(`record the topic of PRD ${prd}`, error);
    },

    async stagesOf({ workspace_id, repository, prd }) {
      const { data, error } = await db.from(STAGES_TABLE).select('stage, reached_at, synced_at')
        .eq('workspace_id', workspace_id).eq('repository', lower(repository)).eq('prd', prd);
      settle(`read the stages of PRD ${prd}`, error);
      return stageRows(data);
    },

    async currentStages(workspace, prds) {
      if (prds && prds.length === 0) return new Map();
      const rows: (PrdRef & { stage: StoredStage })[] = [];
      for (let first = 0; ; first += PAGE) {
        const { data, error } = await db.from(STAGES_TABLE).select('repository, prd, stage')
          .eq('workspace_id', workspace).order('repository').order('prd').order('stage').range(first, first + PAGE - 1);
        settle('read the stages', error);
        const page = (data ?? []) as Record<string, unknown>[];
        for (const row of page) {
          if (isStoredStage(row.stage)) rows.push({ repository: String(row.repository), prd: Number(row.prd), stage: row.stage });
        }
        if (page.length < PAGE) break;
      }
      return currentOf(rows, prds);
    },

    async stageCounts(workspace, prds) {
      return countStages((await store.currentStages(workspace, prds)).values());
    },

    async prdByTopic(workspace, repository, topic) {
      const { data, error } = await db.from(TOPICS_TABLE).select('prd')
        .eq('workspace_id', workspace).eq('repository', lower(repository)).eq('topic', topic).maybeSingle();
      settle(`find the PRD of topic ${topic}`, error);
      const row = data as { prd?: unknown } | null;
      return row && row.prd !== undefined && row.prd !== null ? Number(row.prd) : null;
    },
  };
  return store;
}
