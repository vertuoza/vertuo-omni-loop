// The main watch's store (PRD 2410), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
// the retro's runner queue's pair): the App has no person's session. It writes what the migration
// `20261230090000_main_watch.sql` lets the service role write, and nothing else:
//
//   open    the workspace the App's installation belongs to (`workspaces.github_installation_id`, so
//           a watch goes to no other workspace), then one `prd_main_watch` row per lane, `watching`;
//           a row already there is left as it is, so a replayed merge opens nothing new
//   mark    the lane's breaks into `prd_main_breaks`, a break already there left as it is (its key
//           holds its source), then the lane's `unread`, and `broke` once it has a break; a lane
//           already `clean` is never written again
//   close   a lane still `watching` becomes `clean`, with nothing unread
//
// Beside the store, `watchingJobKeys` (PRD omni-loop-4 s4) finds the jobs a red check suite wakes: the keys of the
// queued `main-watch` jobs of the PRDs whose lane merged at that commit (`prd_main_watch.merge_sha`, a target's lane
// too, its job being the plan repository's).
//
// Throws when the database refuses or answers out of shape: the step retries.
import { z } from 'zod';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Connection } from '../approved-check/record.ts';
import { IdRowSchema } from '../retro/runner-queue.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import { MAIN_WATCH_KIND } from './main-watch.ts';
import type { Break } from './signals.ts';

/** A lane to open: the repository it merged into, its merge commit and when its seven days end. */
export type OpenLane = { lane: string; mergeSha: string; mergedAt: string; watchUntil: string };

/** The watch of one PRD: its repository and number, as `prd_milestones` keys them. */
type Prd = { repository: string; prd: PrdNumber };
/** One lane of a workspace's watch. */
export type LaneKey = Prd & { workspace: string; lane: string };

export type Opened = { workspace: string | null; reason: string | null; opened: number };
export type Marked = { added: number };
export type Closed = { closed: boolean };

export type MainWatchStore = {
  open(input: Prd & { installationId: number; lanes: readonly OpenLane[] }): Promise<Opened>;
  mark(input: LaneKey & { breaks: readonly Break[]; unread: readonly string[] }): Promise<Marked>;
  close(input: LaneKey): Promise<Closed>;
};

/** A watch row, as an insert or an update returns it. */
export const LaneRowSchema = z.object({ lane: z.string().min(1) });
const RepositoryRowSchema = z.object({ repository: z.string().min(1) });
const KeyRowSchema = z.object({ key: z.string().min(1) });

/** A break row, as an insert returns it. */
export const SourceRowSchema = z.object({ source: z.string().min(1) });

/** The store, as the service role on `connection`. */
export function mainWatchStore(connection: Connection): MainWatchStore {
  const db = serviceDb(connection);
  const watchOf = ({ workspace, repository, prd, lane }: LaneKey) =>
    ({ workspace_id: workspace, repository: repository.toLowerCase(), prd, lane: lane.toLowerCase() }) as const;

  return {
    async open({ installationId, repository, prd, lanes }) {
      const [workspace] = rowsOf(IdRowSchema, await db.from('workspaces').select('id').eq('github_installation_id', installationId).limit(1));
      if (!workspace) return { workspace: null, reason: `no workspace holds the installation ${String(installationId)}`, opened: 0 };
      const rows = lanes.map(({ lane, mergeSha, mergedAt, watchUntil }) => ({
        ...watchOf({ workspace: workspace.id, repository, prd, lane }),
        merge_sha: mergeSha,
        merged_at: mergedAt,
        watch_until: watchUntil,
      }));
      const made = rowsOf(LaneRowSchema, await db.from('prd_main_watch').upsert(rows, { onConflict: 'workspace_id,repository,prd,lane', ignoreDuplicates: true }).select('lane'));
      return { workspace: workspace.id, reason: null, opened: made.length };
    },

    async mark({ breaks, unread, ...key }) {
      const watch = watchOf(key);
      let added = 0;
      if (breaks.length > 0) {
        const rows = breaks.map(({ kind, source, url, title, parent, at }) => ({ ...watch, kind, source, url, title, parent, at }));
        added = rowsOf(SourceRowSchema, await db.from('prd_main_breaks').upsert(rows, { onConflict: 'workspace_id,repository,prd,lane,kind,source', ignoreDuplicates: true }).select('source')).length;
      }
      const change = breaks.length > 0 ? { status: 'broke', unread: [...unread] } : { unread: [...unread] };
      rowsOf(
        LaneRowSchema,
        await db
          .from('prd_main_watch')
          .update(change)
          .eq('workspace_id', watch.workspace_id)
          .eq('repository', watch.repository)
          .eq('prd', watch.prd)
          .eq('lane', watch.lane)
          .neq('status', 'clean')
          .select('lane'),
      );
      return { added };
    },

    async close(key) {
      const watch = watchOf(key);
      const closed = rowsOf(
        LaneRowSchema,
        await db
          .from('prd_main_watch')
          .update({ status: 'clean', unread: [] })
          .eq('workspace_id', watch.workspace_id)
          .eq('repository', watch.repository)
          .eq('prd', watch.prd)
          .eq('lane', watch.lane)
          .eq('status', 'watching')
          .select('lane'),
      );
      return { closed: closed.length > 0 };
    },
  };
}

/**
 * The keys of the `main-watch` jobs waiting on the merge commit `sha`: the queued jobs of the repositories whose PRD
 * has a lane still `watching` that merged at it, as the service role on `connection`. None when no watch holds it.
 */
export function watchingJobKeys(connection: Connection): (sha: string) => Promise<string[]> {
  const db = serviceDb(connection);
  return async (sha) => {
    const watched = rowsOf(RepositoryRowSchema, await db.from('prd_main_watch').select('repository').eq('merge_sha', sha.toLowerCase()).eq('status', 'watching'));
    const repositories = [...new Set(watched.map((row) => row.repository))];
    if (repositories.length === 0) return [];
    return rowsOf(KeyRowSchema, await db.from('background_jobs').select('key').eq('kind', MAIN_WATCH_KIND).eq('state', 'queued').in('subject', repositories)).map((row) => row.key);
  };
}
