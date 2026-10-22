// The one way the page reads a PRD's watch on main (supabase/migrations/20261228090000_main_watch.sql):
// public.prd_main_watch and public.prd_main_breaks, through the port of ./store.ts, as the signed-in
// member, so row-level security keeps each workspace's rows to its members. A repository is kept in lower
// case, as a dossier's home_repo is. A refusal throws with Supabase's reason; a row whose status or kind
// this build does not know is left out, not refused.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../data/parse-rows';
import { settle } from '../stages/store';
import type { BreakRow, MainWatchStore, ParentResult, WatchRow } from './store';

type Db = Pick<SupabaseClient<Database>, 'from'>;

const WATCH_COLUMNS = 'lane, merge_sha, merged_at, watch_until, status, unread';
const BREAK_COLUMNS = 'lane, kind, source, url, title, parent, at';

/** A watch as WATCH_COLUMNS reads it. */
export const StoredWatch = z.strictObject({
  lane: z.string(), merge_sha: z.string(), merged_at: z.string(), watch_until: z.string(), status: z.string(), unread: z.array(z.string()),
});
/** A break as BREAK_COLUMNS reads it. */
export const StoredBreak = z.strictObject({
  lane: z.string(), kind: z.string(), source: z.string(), url: z.string(), title: z.string(), parent: z.string().nullable(), at: z.string(),
});

/** The selects as the store makes them, before their filters; registered for `pnpm schemas:verify`. */
export const watchRows = (db: Db) => db.from('prd_main_watch').select(WATCH_COLUMNS);
export const breakRows = (db: Db) => db.from('prd_main_breaks').select(BREAK_COLUMNS);

const isStatus = (value: string): value is WatchRow['status'] => value === 'watching' || value === 'clean' || value === 'broke';
const isKind = (value: string): value is BreakRow['kind'] => value === 'ci-red' || value === 'revert' || value === 'regression';
const isParent = (value: string): value is ParentResult => value === 'green' || value === 'red' || value === 'unknown';

const watchOf = (row: z.infer<typeof StoredWatch>): WatchRow[] => (isStatus(row.status) ? [{ ...row, status: row.status }] : []);
const breakOf = (row: z.infer<typeof StoredBreak>): BreakRow[] =>
  (isKind(row.kind) ? [{ ...row, kind: row.kind, parent: row.parent !== null && isParent(row.parent) ? row.parent : null }] : []);

const byLane = (a: { lane: string }, b: { lane: string }) => a.lane.localeCompare(b.lane);

export function mainWatchStore(db: Db): MainWatchStore {
  return {
    async mainWatchOf({ workspace_id, repository, prd }) {
      const repo = repository.toLowerCase();
      const watches = await watchRows(db).eq('workspace_id', workspace_id).eq('repository', repo).eq('prd', prd);
      settle(`read the main watch of PRD ${prd}`, watches.error);
      const breaks = await breakRows(db).eq('workspace_id', workspace_id).eq('repository', repo).eq('prd', prd).order('at');
      settle(`read the breaks of PRD ${prd}`, breaks.error);
      return {
        watches: orThrow(parseRows(StoredWatch, watches.data, 'main-watch/store: prd_main_watch')).flatMap(watchOf).sort(byLane),
        breaks: orThrow(parseRows(StoredBreak, breaks.data, 'main-watch/store: prd_main_breaks')).flatMap(breakOf),
      };
    },
  };
}
