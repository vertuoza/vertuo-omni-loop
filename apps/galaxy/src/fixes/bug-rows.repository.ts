// The one way into the Fixes rows of a product bug and its unmatched merges (PRD 2011, s8): public.fix_rows and
// public.fix_unmatched_merges, read as the signed-in member, so row-level security keeps them to the record's workspace.
import type { SupabaseClient } from '@supabase/supabase-js';
import { bugRowsView, type BugRowsView } from './bug-rows';

/** The rows and unmatched merges of dossier `id`, as the member; null when they could not be read. */
export async function readBugRows(db: Pick<SupabaseClient, 'from'>, id: string): Promise<BugRowsView | null> {
  const [rows, unmatched] = await Promise.all([
    db.from('fix_rows').select('position, repository, pull, state, changes').eq('dossier_id', id).order('position'),
    db.from('fix_unmatched_merges').select('repository, pull').eq('dossier_id', id).order('seen_at'),
  ]);
  if (rows.error || unmatched.error) {
    console.error(rows.error ?? unmatched.error);
    return null;
  }
  return bugRowsView(rows.data, unmatched.data);
}
