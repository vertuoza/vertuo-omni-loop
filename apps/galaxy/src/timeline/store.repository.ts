// The one way into a PRD's stored milestones (supabase/migrations/20261227090000_prd_milestones.sql):
// public.prd_milestones, through the port of ./store.ts. The stages sync writes, as the service role; the
// pages read, as the signed-in member, so row-level security keeps each workspace's rows to its members.
//
// A repository and a lane are kept in lower case, as a dossier's home_repo is. Writing a milestone again
// refreshes when it was last seen (synced_at), and the database keeps its first time, but a later
// last-slice. A refusal throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../data/parse-rows';
import { settle } from '../stages/store';
import { byLaneThenTimeline, isMilestone, type MilestoneRow, type MilestoneStore, type WorkspaceMilestone } from './store';
import { PrdNumberSchema, PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';

const TABLE = 'prd_milestones';
/** The project's max_rows (supabase/config.toml): the most rows one read returns, and one write sends. */
const PAGE = 1000;

type Db = Pick<SupabaseClient<Database>, 'from'>;

/** The columns of a PRD's milestone, as milestonesOf() reads them. */
const MILESTONE_COLUMNS = 'lane, milestone, pr, reached_at';
/** The columns of a workspace's milestone, as workspaceMilestones() reads them. */
const WORKSPACE_COLUMNS = 'repository, prd, lane, milestone, pr, reached_at';

/** A milestone's row as MILESTONE_COLUMNS reads it. A milestone this build does not know is left out, not refused. */
export const StoredMilestone = z.strictObject({ lane: z.string(), milestone: z.string(), pr: PrNumberSchema.nullable(), reached_at: z.string() });
/** A workspace's milestone as WORKSPACE_COLUMNS reads it. */
export const StoredWorkspaceMilestone = StoredMilestone.extend({ repository: z.string(), prd: PrdNumberSchema });
const SyncedRow = z.strictObject({ synced_at: z.string() });

/** The PRDs' milestones as milestonesOf() selects them, before its filters; registered for `pnpm schemas:verify`. */
export const milestoneRows = (db: Db) => db.from(TABLE).select(MILESTONE_COLUMNS);
/** The workspaces' milestones as workspaceMilestones() selects them, before its filters and pages. */
export const workspaceMilestoneRows = (db: Db) => db.from(TABLE).select(WORKSPACE_COLUMNS);

const lower = (repository: string) => repository.toLowerCase();

/** The rows of the milestones this build knows. */
function known<T extends { milestone: string }>(rows: readonly T[]): (Omit<T, 'milestone'> & Pick<MilestoneRow, 'milestone'>)[] {
  return rows.flatMap(({ milestone, ...rest }) => (isMilestone(milestone) ? [{ ...rest, milestone }] : []));
}

export function milestoneStore(db: Db): MilestoneStore {
  return {
    async recordMilestones(rows, syncedAt = new Date().toISOString()) {
      const values = rows.map((r) => ({
        workspace_id: r.workspace_id, repository: lower(r.repository), prd: r.prd, lane: lower(r.lane),
        milestone: r.milestone, pr: r.pr, reached_at: r.reached_at, synced_at: syncedAt,
      }));
      for (let first = 0; first < values.length; first += PAGE) {
        const batch = values.slice(first, first + PAGE);
        const { error } = await db.from(TABLE).upsert(batch, { onConflict: 'workspace_id,repository,prd,lane,milestone' });
        settle(`record ${batch.length} ${batch.length === 1 ? 'milestone' : 'milestones'}`, error);
      }
    },

    async milestonesOf({ workspace_id, repository, prd }) {
      const { data, error } = await milestoneRows(db).eq('workspace_id', workspace_id).eq('repository', lower(repository)).eq('prd', prd);
      settle(`read the milestones of PRD ${prd}`, error);
      return known(orThrow(parseRows(StoredMilestone, data, 'timeline/store: prd_milestones'))).sort(byLaneThenTimeline);
    },

    async workspaceMilestones(workspace) {
      const rows: WorkspaceMilestone[] = [];
      for (let first = 0; ; first += PAGE) {
        const { data, error } = await workspaceMilestoneRows(db).eq('workspace_id', workspace)
          .order('repository').order('prd').order('lane').order('milestone').range(first, first + PAGE - 1);
        settle('read the milestones', error);
        const page = orThrow(parseRows(StoredWorkspaceMilestone, data, 'timeline/store: prd_milestones of a workspace'));
        rows.push(...known(page));
        if (page.length < PAGE) break;
      }
      return rows;
    },

    async lastSynced(workspace, repository) {
      const { data, error } = await db.from(TABLE).select('synced_at')
        .eq('workspace_id', workspace).eq('repository', lower(repository))
        .order('synced_at', { ascending: false }).limit(1).maybeSingle();
      settle(`read when the milestones of ${lower(repository)} were last synced`, error);
      const row = data === null ? null : orThrow(parseRows(SyncedRow, [data], 'timeline/store: prd_milestones synced_at'))[0];
      return row?.synced_at ?? null;
    },
  };
}
