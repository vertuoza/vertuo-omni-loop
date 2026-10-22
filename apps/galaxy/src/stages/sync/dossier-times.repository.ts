// The sync's read of when each PRD's dossier was opened and its plan first written (PRD 2370, s3), as the
// service role: the repository's numbered PRD dossiers, each with its own `created_at` and the earliest
// of its `plan` versions (supabase/migrations/20260928090000_dossiers.sql). They date a PRD's `idea` and
// `plan` milestones (./milestones.ts). A dossier with no plan version has no plan time: null, never a
// guess. A refusal throws with Supabase's reason, and the sync logs it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { settle } from '../store';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';

/** A PRD's dossier: when it was opened, and when its first plan version was written (null: none yet). */
export type DossierTimes = { prd: PrdNumber; opened_at: string; plan_at: string | null };

export type DossierTimesStore = {
  /** The repository's numbered PRD dossiers with their times. */
  dossierTimes(workspaceId: string, repository: string): Promise<DossierTimes[]>;
};

const DOSSIER_TIMES_COLUMNS = 'prd, created_at, dossier_versions(created_at)';

const Time = z.string().refine((at) => !Number.isNaN(Date.parse(at)));

/** A PRD dossier, as DOSSIER_TIMES_COLUMNS reads it, its versions narrowed to the plan's. */
export const DossierTimesRow = z.object({
  prd: PrdNumberSchema,
  created_at: Time,
  dossier_versions: z.array(z.object({ created_at: Time })),
});

type Db = Pick<SupabaseClient<Database>, 'from'>;

const iso = (at: string) => new Date(Date.parse(at)).toISOString();

/** The select behind the store, also what the boundary reads: the PRD dossiers with their plan versions. */
export const dossierTimesRows = (db: Db) =>
  db.from('dossiers').select(DOSSIER_TIMES_COLUMNS).eq('kind', 'prd').not('prd', 'is', null).eq('dossier_versions.kind', 'plan');

export function dossierTimesStore(db: Db): DossierTimesStore {
  return {
    async dossierTimes(workspaceId, repository) {
      const { data, error } = await dossierTimesRows(db).eq('workspace_id', workspaceId).eq('home_repo', repository.toLowerCase());
      settle('read the PRD dossiers\' times', error);
      return orThrow(parseRows(DossierTimesRow, data ?? [], 'stages/sync: dossier times')).map(({ prd, created_at, dossier_versions }) => {
        const plans = dossier_versions.map((v) => Date.parse(v.created_at));
        return { prd, opened_at: iso(created_at), plan_at: plans.length === 0 ? null : new Date(Math.min(...plans)).toISOString() };
      });
    },
  };
}
