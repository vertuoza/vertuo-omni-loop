// The one way into the GitHub snapshots (supabase/migrations/20261031090000_dossier_github.sql, PRD 902
// s2): public.dossier_github. The galaxy server reads and writes them as the service role, as it writes
// prd_stages and fix_facts; a member's own client may read their workspace's (row-level security). A
// row whose summary is not a GithubSummary reads as none. A refusal throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import type { GithubSummary } from '../github/summary';
import { orNull, parseRow } from '../../data/parse-rows';
import { settle } from '../../stages/store';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { StoredSummary } from './schema';

const TABLE = 'dossier_github';

/** A dossier's snapshot: the summary, when it was read, since when it is known stale (null while
 * current), and until when a refresh holds its lease (null when none runs). Times are ISO. */
export type Snapshot = { summary: GithubSummary; readAt: string; staleSince: string | null; refreshingUntil: string | null };

/** What a read or a refresh stores: the summary read at `readAt`. */
export type SnapshotWrite = { dossierId: string; workspaceId: string; summary: GithubSummary; readAt: string };

export type SnapshotStore = {
  /** The dossier's snapshot; null when it has none. */
  read(dossierId: string): Promise<Snapshot | null>;
  /** Stores the summary read, in place of the one it had, and frees its lease. */
  write(row: SnapshotWrite): Promise<void>;
  /** Marks the snapshot stale since `at`, unless it already is. */
  markStale(dossierId: string, at: string): Promise<void>;
  /** Clears the stale mark set at or before `before`: a mark set during the refresh stays. */
  current(dossierId: string, before: string): Promise<void>;
  /** Takes the refresh lease until `until`, when none holds at `now`; whether it was taken. */
  lease(dossierId: string, now: string, until: string): Promise<boolean>;
  /** Frees the refresh lease. */
  release(dossierId: string): Promise<void>;
  /** The numbered PRD dossier of the workspace for `repository` and `prd`; null when there is none. */
  dossierOf(workspaceId: string, repository: string, prd: PrdNumber): Promise<string | null>;
};

export const SNAPSHOT_COLUMNS = 'summary, read_at, stale_since, refreshing_until';

/** A dossier_github row, as SNAPSHOT_COLUMNS reads it. */
export const StoredSnapshotRow = z.object({
  summary: StoredSummary,
  read_at: z.string(),
  stale_since: z.string().nullable(),
  refreshing_until: z.string().nullable(),
});

const DossierIdRow = z.object({ id: z.string() });
const LeasedRows = z.array(z.object({ dossier_id: z.string() }));

type Db = Pick<SupabaseClient<Database>, 'from'>;

export function snapshotStore(db: Db): SnapshotStore {
  return {
    async read(dossierId) {
      const { data, error } = await db.from(TABLE).select(SNAPSHOT_COLUMNS).eq('dossier_id', dossierId).maybeSingle();
      settle('read the GitHub snapshot', error);
      if (data === null) return null;
      const row = orNull(parseRow(StoredSnapshotRow, data, 'dossier/snapshot: dossier_github'));
      return row && { summary: row.summary, readAt: row.read_at, staleSince: row.stale_since, refreshingUntil: row.refreshing_until };
    },

    async write({ dossierId, workspaceId, summary, readAt }) {
      const { error } = await db.from(TABLE).upsert(
        { dossier_id: dossierId, workspace_id: workspaceId, summary, read_at: readAt, refreshing_until: null },
        { onConflict: 'dossier_id' },
      );
      settle('store the GitHub snapshot', error);
    },

    async markStale(dossierId, at) {
      const { error } = await db.from(TABLE).update({ stale_since: at }).eq('dossier_id', dossierId).is('stale_since', null);
      settle('mark the GitHub snapshot stale', error);
    },

    async current(dossierId, before) {
      const { error } = await db.from(TABLE).update({ stale_since: null }).eq('dossier_id', dossierId).lte('stale_since', before);
      settle('mark the GitHub snapshot current', error);
    },

    async lease(dossierId, now, until) {
      const { data, error } = await db.from(TABLE).update({ refreshing_until: until }).eq('dossier_id', dossierId)
        .or(`refreshing_until.is.null,refreshing_until.lt.${now}`).select('dossier_id');
      settle('lease the GitHub snapshot\'s refresh', error);
      const rows = orNull(parseRow(LeasedRows, data ?? [], 'dossier/snapshot: dossier_github lease'));
      return (rows?.length ?? 0) > 0;
    },

    async release(dossierId) {
      const { error } = await db.from(TABLE).update({ refreshing_until: null }).eq('dossier_id', dossierId);
      settle('free the GitHub snapshot\'s lease', error);
    },

    async dossierOf(workspaceId, repository, prd) {
      const { data, error } = await db.from('dossiers').select('id').eq('workspace_id', workspaceId)
        .ilike('home_repo', repository.replace(/[\\%_]/g, (c) => `\\${c}`)).eq('prd', prd).eq('kind', 'prd').limit(1).maybeSingle();
      settle('find the PRD\'s dossier', error);
      if (data === null) return null;
      return orNull(parseRow(DossierIdRow, data, 'dossier/snapshot: dossiers'))?.id ?? null;
    },
  };
}
