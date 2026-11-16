// The snapshots a touch is matched against (PRD 902, s3): a workspace's dossier_github rows of one
// repository, read as the service role, each with the keys a touch matches on. The repository is filtered
// here, not after the read: every webhook of the organisation touches, and most name a repository with no
// dossier, so reading the whole workspace each time cost 3 MB a touch (#1854). It filters on the stored,
// indexed `repo` column (the summary's repository in lower case), never on the jsonb summary: a filter on
// summary->>repo detoasted every summary of the workspace on each webhook, 36% of the database's time (#2952).
// And it selects the stored keys (prd, issue, pulls), never the summary: reading every summary of a busy
// repository whole, about 1 MB a webhook, to look at four numbers was still 28% of it (#2970). The home
// repository comes from the dossier, as the snapshot's reader takes it. A row whose keys do not parse is left
// out (logged), never the whole read. A refusal throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { orEmpty, parseRows } from '../data/parse-rows';
import { StoredSummary } from '../dossier/snapshot/schema';
import type { FixRef } from '../dossier/github/reader';
import type { GithubSummary } from '../dossier/github/summary';
import { IssueNumberSchema, PrdNumberSchema, PrNumberSchema, type IssueNumber, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { TouchedSnapshot } from './touched';

export const TOUCHED_COLUMNS = 'dossier_id, prd, issue, pulls, dossiers(home_repo)';

/** A dossier_github row as TOUCHED_COLUMNS reads it: the keys the database generates from its summary. */
export const TouchedRow = z.object({
  dossier_id: z.string(),
  prd: PrdNumberSchema,
  issue: IssueNumberSchema.nullable(),
  pulls: z.array(PrNumberSchema),
  dossiers: z.object({ home_repo: z.string() }),
});

/** Any dossier_github row, by its id: each is parsed with TouchedRow on its own, so one bad row is left out alone. */
const AnyRow = z.object({ dossier_id: z.string() }).loose();

export const SNAPSHOT_COLUMNS = 'dossier_id, summary';

/** A dossier_github row as SNAPSHOT_COLUMNS reads it; its summary is parsed on its own. */
export const SnapshotRow = z.object({ dossier_id: z.string(), summary: z.unknown() });

type Db = Pick<SupabaseClient<Database>, 'from'>;

/** `value` as an ilike pattern that matches it alone: its wildcards and escape, escaped. */
const literally = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The snapshots of the workspace's dossiers in `repository` (`owner/name`, in any case), as a touch matches them. */
export async function snapshotsOf(db: Db, workspace: string, repository: string, log: (line: string) => void = console.error): Promise<TouchedSnapshot[]> {
  const { data, error } = await db.from('dossier_github').select(TOUCHED_COLUMNS).eq('workspace_id', workspace)
    .eq('repo', repository.toLowerCase());
  if (error) throw new Error(`Supabase refused to read the workspace's GitHub snapshots: ${error.message}`);
  return orEmpty(parseRows(AnyRow, data, 'touched/store: dossier_github', log)).flatMap((row) => {
    const read = TouchedRow.safeParse(row);
    if (!read.success) {
      log(`touched/store: dossier_github: the keys of ${row.dossier_id}'s snapshot do not parse`);
      return [];
    }
    const { dossier_id: dossierId, prd, issue, pulls, dossiers } = read.data;
    return [{ dossierId, repo: dossiers.home_repo, prd, issue, pulls }];
  });
}

/** The snapshot of the workspace's PRD `prd` in `repository` (`owner/name`, in any case), its summary whole;
 * null when there is none, or when its summary does not parse (logged). */
export async function snapshotOf(db: Db, workspace: string, repository: string, prd: PrdNumber, log: (line: string) => void = console.error): Promise<GithubSummary | null> {
  const { data, error } = await db.from('dossier_github').select(SNAPSHOT_COLUMNS).eq('workspace_id', workspace)
    .eq('repo', repository.toLowerCase()).eq('prd', prd).limit(1);
  if (error) throw new Error(`Supabase refused to read the PRD's GitHub snapshot: ${error.message}`);
  const [row] = orEmpty(parseRows(SnapshotRow, data, 'touched/store: dossier_github summary', log));
  if (!row) return null;
  const read = StoredSummary.safeParse(row.summary);
  if (read.success) return read.data;
  log(`touched/store: dossier_github: the snapshot of ${row.dossier_id} does not parse`);
  return null;
}

export const CONCEPT_COLUMNS = 'id, home_repo, prd';

/** A concept dossier's row as CONCEPT_COLUMNS reads it. */
export const ConceptRow = z.object({ id: z.string(), home_repo: z.string(), prd: IssueNumberSchema });

/** The workspace's concept dossier in `repository` (`owner/name`, in any case) whose issue is `issue`; null when none. */
export async function conceptOf(db: Db, workspace: string, repository: string, issue: IssueNumber, log: (line: string) => void = console.error): Promise<FixRef | null> {
  const { data, error } = await db.from('dossiers').select(CONCEPT_COLUMNS).eq('workspace_id', workspace)
    .eq('kind', 'concept').eq('prd', issue).ilike('home_repo', literally(repository)).limit(1);
  if (error) throw new Error(`Supabase refused to read the workspace's concepts: ${error.message}`);
  const [row] = orEmpty(parseRows(ConceptRow, data, 'touched/store: dossiers', log));
  return row ? { id: row.id, home_repo: row.home_repo, prd: row.prd } : null;
}
