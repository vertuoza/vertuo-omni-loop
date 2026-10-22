// The main watch's store (PRD 2410), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
// the retro's runner queue's pair): the App has no person's session. It writes what the migration
// `20261228090000_main_watch.sql` lets the service role write, and nothing else:
//
//   open    the workspace the App's installation belongs to (`workspaces.github_installation_id`, so
//           a watch goes to no other workspace), then one `prd_main_watch` row per lane, `watching`;
//           a row already there is left as it is, so a replayed merge opens nothing new
//   mark    the lane's breaks into `prd_main_breaks`, a break already there left as it is (its key
//           holds its source), then the lane's `unread`, and `broke` once it has a break; a lane
//           already `clean` is never written again
//   close   a lane still `watching` becomes `clean`, with nothing unread
//
// Throws when the database refuses or answers out of shape: the step retries.
import { z } from 'zod';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Connection } from '../approved-check/record.ts';
import { IdRowSchema } from '../retro/runner-queue.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
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
