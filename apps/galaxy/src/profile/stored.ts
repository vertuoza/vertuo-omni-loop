// The profile's rows (PRD 698 s3, parsed since PRD 1030): a tracked repository, a pull request and a
// review, as the profile's selects read them. Apart from profile.ts, which is the server's alone, so
// `pnpm schemas:verify` (profile.boundary.ts) can load them outside Next.js.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';

/** The columns of a pull request the profile reads. */
export const PR_COLUMNS = 'repo, number, author, author_is_bot, opened_at, merged_at, closed_at, merged_by, commits, additions, deletions, omni_signed';

/** A pull request as PR_COLUMNS reads it. */
export const StoredPullRequest = z.strictObject({
  repo: z.string(), number: z.number(), author: z.string().nullable(), author_is_bot: z.boolean(), opened_at: z.string(),
  merged_at: z.string().nullable(), closed_at: z.string().nullable(), merged_by: z.string().nullable(), commits: z.number(),
  additions: z.number(), deletions: z.number(), omni_signed: z.boolean(),
});

/** The columns of a review the profile reads. */
export const REVIEW_COLUMNS = 'repo, number, reviewer, first_at';

/** A review as REVIEW_COLUMNS reads it. */
export const StoredReview = z.strictObject({ repo: z.string(), number: z.number(), reviewer: z.string(), first_at: z.string() });

/** A tracked repository, as the profile reads its name. */
export const TrackedRepository = z.strictObject({ full_name: z.string() });

/** The full names of the workspace's tracked repositories, parsed (`where` names the read in a log).
 * Throws when the read fails. */
export async function readTracked(db: SupabaseClient, workspace: string, where: string): Promise<string[]> {
  const { data, error } = await db.from('repositories').select('full_name').eq('workspace_id', workspace).eq('tracked', true);
  if (error) throw new Error(`Supabase: could not read the tracked repositories (${error.message})`);
  return orThrow(parseRows(TrackedRepository, data, where)).map((r) => r.full_name);
}
