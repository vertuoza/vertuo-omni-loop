// The snapshots a touch is matched against (PRD 902, s3): a workspace's dossier_github rows, read as the
// service role, each with the summary its dossier's snapshot holds. A row whose summary is not a
// GithubSummary is left out (logged), never the whole read. A refusal throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { orEmpty, parseRows } from '../data/parse-rows';
import { StoredSummary } from '../dossier/snapshot/schema';
import type { TouchedSnapshot } from './touched';

export const TOUCHED_COLUMNS = 'dossier_id, summary';

/** A dossier_github row as TOUCHED_COLUMNS reads it; its summary is parsed on its own. */
export const TouchedRow = z.object({ dossier_id: z.string(), summary: z.unknown() });

type Db = Pick<SupabaseClient<Database>, 'from'>;

/** The workspace's dossiers' snapshots. */
export async function snapshotsOf(db: Db, workspace: string, log: (line: string) => void = console.error): Promise<TouchedSnapshot[]> {
  const { data, error } = await db.from('dossier_github').select(TOUCHED_COLUMNS).eq('workspace_id', workspace);
  if (error) throw new Error(`Supabase refused to read the workspace's GitHub snapshots: ${error.message}`);
  return orEmpty(parseRows(TouchedRow, data, 'touched/store: dossier_github', log)).flatMap(({ dossier_id: dossierId, summary }) => {
    const read = StoredSummary.safeParse(summary);
    if (read.success) return [{ dossierId, summary: read.data }];
    log(`touched/store: dossier_github: the snapshot of ${dossierId} does not parse`);
    return [];
  });
}
