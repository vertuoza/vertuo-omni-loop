import type { SupabaseClient } from '@supabase/supabase-js';
import { ReadyRowSchema, type ReadyRow } from './ready';

// The Ready panel's one read (PRD 2898 s9), as the signed-in member, so row-level security decides: the
// latest verdict the Omni App saved for a PRD of a repository. It holds no rule.

/** A Supabase client's tables, as the member reads them. */
export type ReadyDb = Pick<SupabaseClient, 'from'>;

/** The latest saved verdict of PRD `prd` in `repo` (`owner/name`); null when the App saved none. Throws when the database fails or answers out of shape. */
export async function readLatestVerdict(db: ReadyDb, repo: string, prd: number): Promise<ReadyRow | null> {
  const { data, error } = await db
    .from('ready_verdicts')
    .select('repo, prd, pr_number, head_sha, state, passed, headline, checks, criteria, decided_at')
    .eq('repo', repo.toLowerCase())
    .eq('prd', prd)
    .order('decided_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`read the ready verdict: ${error.message}`);
  const answer: unknown = data;
  const [row] = Array.isArray(answer) ? (answer as unknown[]) : [];
  if (row === undefined) return null;
  const read = ReadyRowSchema.safeParse(row);
  if (!read.success) throw new Error('read the ready verdict: answered out of shape');
  return read.data;
}
