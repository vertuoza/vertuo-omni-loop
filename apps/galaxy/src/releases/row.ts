// A row of public.releases (supabase/migrations/20260929090000_releases.sql, PRD 262): one per shipped
// PRD, stamped once by the sync (pnpm releases:sync) with its release number and the date its shipped
// folder first reached main, and carrying its release note's title and description. Anyone may read
// the table; only the service role writes it. The sync writes rows of this shape, and the /releases
// page reads them.
//
// No Next.js, no Node-only import: the page and the sync's plain Node script both load this module.
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

export const RELEASES_TABLE = 'releases';
/** Every column, in the table's order: what a read selects. */
export const RELEASE_COLUMNS = 'prd,release,released_at,title,description';

/** The initial release's number: every PRD shipped before release notes existed shares it. */
export const INITIAL_RELEASE = 1;

export const ReleaseRow = z.object({
  /** The PRD number. */
  prd: PrdNumberSchema,
  /** The patch number: the release is shown as `0.0.<release>`. Unique above 1; 1 is shared. */
  release: z.number().int().min(INITIAL_RELEASE),
  /** When the PRD's shipped folder first reached main, ISO 8601 with its offset, as Postgres returns it. */
  released_at: z.iso.datetime({ offset: true }),
  title: z.string().min(1),
  /** The note's description; empty for a PRD shipped with no note. */
  description: z.string(),
}).strict();

export type ReleaseRow = z.infer<typeof ReleaseRow>;

/** A page of rows as read from the table; throws, naming the row, on one it cannot read. */
export function parseReleaseRows(rows: unknown[]): ReleaseRow[] {
  return rows.map((raw, i) => {
    const parsed = ReleaseRow.safeParse(raw);
    if (!parsed.success) {
      const issue = at(parsed.error.issues, 0, 'the failed parse\'s first issue');
      throw new Error(`${RELEASES_TABLE}: row ${i + 1} is not a release (${issue.path.join('.') || 'row'}: ${issue.message})`);
    }
    return parsed.data;
  });
}

/** The version a release is shown as, always in full: `0.0.<release>`. */
export function releaseVersion(release: number): string {
  return `0.0.${release}`;
}
