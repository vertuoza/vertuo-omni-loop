// The fix stamp's write (PRD 2011 s7): `fix_row_stamp()` called as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`, the approved check's own pair), the only writer of a Fixes row's merge
// (supabase/migrations/20261211090000_fix_rows.sql). The App has no person's session, and the function
// is granted to the service role alone.
//
// Every row of the repository and pull request takes the change: a merge stamps `merged_at` once (a
// replay keeps the first, and ships nothing twice), a close marks the row not merged, a reopen clears the
// close. The last merge of a record's rows ships it. A merge matching no row, whose body names a record of
// a product holding the repository, is kept once on that record as an unmatched merge. It writes nothing
// on GitHub and never merges anything. Throws when the database refuses or answers out of shape.
import { z } from 'zod';
import { ProductBugIdSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Connection } from '../approved-check/record.ts';
import { serviceDb } from '../server-event/service-db.ts';
import type { FixStampData } from './fix-stamp.ts';

/** One row the stamp reached: its record, its place there, and the state it is in now. */
const StampedRowSchema = z.object({
  bug: ProductBugIdSchema,
  dossierId: z.string().min(1),
  position: z.number().int().positive(),
  state: z.enum(['open', 'merged', 'closed']),
});

/** What `fix_row_stamp()` answers: the rows it reached, the records it shipped, the record an unmatched merge was kept on. */
const StampAnswerSchema = z.object({
  rows: z.array(StampedRowSchema),
  shipped: z.array(ProductBugIdSchema),
  unmatched: ProductBugIdSchema.nullable(),
});
export type StampAnswer = z.infer<typeof StampAnswerSchema>;

/** A stamp: the pull request, what happened to it and when, and the record its body names. */
export type FixStamp = Pick<FixStampData, 'repository' | 'prNumber' | 'kind' | 'at' | 'bug'>;

/** Stamps the rows of one pull request; what the database answered. */
export type FixStamper = (stamp: FixStamp) => Promise<StampAnswer>;

/** The stamper, as the service role on `connection`. */
export function fixRowStamper(connection: Connection): FixStamper {
  const db = serviceDb(connection);
  return async ({ repository, prNumber, kind, at, bug }) => {
    const { data, error } = await db.rpc('fix_row_stamp', {
      p_repo: repository,
      p_pull: prNumber,
      p_event: kind,
      p_at: at,
      ...(bug === null ? {} : { p_bug: bug }),
    });
    if (error) throw new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
    return StampAnswerSchema.parse(data);
  };
}
