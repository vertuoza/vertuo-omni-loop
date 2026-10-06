// The sync's way into the GitHub snapshots and the client's ETags (PRD 902, s4), as the service role:
// dossier_github (supabase/migrations/20261031090000_dossier_github.sql), marked stale by what changed
// and by age and listed when stale, and github_etags (20261030090000_github_budget.sql, whose delete the
// service role holds for this), cleared of the rows nobody read for a week. The refresh itself goes
// through the snapshot (../../dossier/snapshot), never through here. A refusal throws with Supabase's
// reason, and the sync logs it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import type { DossierRef } from '../../dossier/github/reader';
import { orThrow, parseRows } from '../../data/parse-rows';
import { settle } from '../store';
import { PrdNumberSchema, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

export type SyncSnapshotStore = {
  /** Marks stale since `at` the current snapshot of each of the repository's PRDs given. */
  markChanged(workspaceId: string, repository: string, prds: readonly PrdNumber[], at: string): Promise<void>;
  /** Marks stale since `at` every current snapshot of the workspace read before `before`. */
  markOld(workspaceId: string, before: string, at: string): Promise<void>;
  /** The PRD dossiers of the repository whose snapshot is stale. */
  stale(workspaceId: string, repository: string): Promise<DossierRef[]>;
  /** Deletes the ETags not read since `before`. */
  dropEtags(before: string): Promise<void>;
};

export const STALE_COLUMNS = 'dossier_id, dossiers!inner(home_repo, prd)';

/** A stale snapshot, as STALE_COLUMNS reads it: its dossier's repository and PRD. */
export const StaleSnapshotRow = z.object({
  dossier_id: z.string(),
  dossiers: z.object({ home_repo: z.string(), prd: PrdNumberSchema }),
});

const DossierIdRow = z.object({ id: z.string() });

/** `repository` as an ilike pattern that matches it alone, in any case. */
const exactly = (repository: string) => repository.replace(/[\\%_]/g, (c) => `\\${c}`);

type Db = Pick<SupabaseClient<Database>, 'from'>;

export function syncSnapshotStore(db: Db): SyncSnapshotStore {
  return {
    async markChanged(workspaceId, repository, prds, at) {
      const { data, error } = await db.from('dossiers').select('id').eq('workspace_id', workspaceId).eq('kind', 'prd')
        .ilike('home_repo', exactly(repository)).in('prd', [...prds]);
      settle('find the changed PRDs\' dossiers', error);
      const ids = orThrow(parseRows(DossierIdRow, data ?? [], 'stages/sync: dossiers')).map((row) => row.id);
      if (ids.length === 0) return;
      const marked = await db.from('dossier_github').update({ stale_since: at }).in('dossier_id', ids).is('stale_since', null);
      settle('mark the changed GitHub snapshots stale', marked.error);
    },

    async markOld(workspaceId, before, at) {
      const { error } = await db.from('dossier_github').update({ stale_since: at }).eq('workspace_id', workspaceId)
        .lt('read_at', before).is('stale_since', null);
      settle('mark the old GitHub snapshots stale', error);
    },

    async stale(workspaceId, repository) {
      const { data, error } = await db.from('dossier_github').select(STALE_COLUMNS).eq('workspace_id', workspaceId)
        .not('stale_since', 'is', null).ilike('dossiers.home_repo', exactly(repository));
      settle('list the stale GitHub snapshots', error);
      return orThrow(parseRows(StaleSnapshotRow, data ?? [], 'stages/sync: dossier_github'))
        .map(({ dossier_id, dossiers }) => ({ id: dossier_id, home_repo: dossiers.home_repo, prd: dossiers.prd }));
    },

    async dropEtags(before) {
      const { error } = await db.from('github_etags').delete().lt('read_at', before);
      settle('drop the idle ETags', error);
    },
  };
}
