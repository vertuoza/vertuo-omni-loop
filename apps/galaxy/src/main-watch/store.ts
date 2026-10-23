// A PRD's watch on main (PRD 2410, s3): what the Omni App recorded in public.prd_main_watch and
// public.prd_main_breaks (supabase/migrations/20261230090000_main_watch.sql) once the PRD merged. This is
// the page's read port: a PRD's watches, one per lane (a repository it merged into), and the signals that
// broke them. The Omni App writes, as the service role; the page reads as the signed-in member. The
// Supabase store is ./store.repository.ts.
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';

/** A PRD of a workspace: its repository (`owner/name`) and its issue number. */
export type MainWatchKey = { workspace_id: string; repository: string; prd: PrdNumber };

export type WatchStatus = 'watching' | 'clean' | 'broke';
export type BreakKind = 'ci-red' | 'revert' | 'regression';
/** The parent commit's result for the same checks, kept beside a red job on the merge commit. */
export type ParentResult = 'green' | 'red' | 'unknown';

/** One lane's watch: the merge commit, when the seven days end, its status, and each signal it could not read. */
export type WatchRow = { lane: string; merge_sha: string; merged_at: string; watch_until: string; status: WatchStatus; unread: string[] };
/** One signal that broke a lane; `parent` is a ci-red's alone. */
export type BreakRow = { lane: string; kind: BreakKind; source: string; url: string; title: string; parent: ParentResult | null; at: string };

/** What the page reads of a PRD: its watches, lane by lane, and the breaks, the oldest first. */
export type MainWatchRead = { watches: WatchRow[]; breaks: BreakRow[] };

export type MainWatchStore = {
  /** A PRD's watches and breaks; empty when it was never watched. */
  mainWatchOf(key: MainWatchKey): Promise<MainWatchRead>;
};
