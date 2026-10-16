// The fix stamp's event (PRD 2011 s7): a pull request closed, merged or not, or reopened, as the webhook
// hands it to the `fix-row-stamp` function (./fix-row-stamp.ts), which stamps the Fixes rows of a bug
// record born on the server whose repository and pull request it is.
//
// The webhook reads no database, so it cannot tell a fix's pull request from any other: it sends the
// event for every pull request of the repository's default branch, where a fix lands, and, on any
// branch, for one whose body names a record (`Fixes mobile-B74 · <link>`, the line
// `/omni:mega-bug-fix --product` writes), so a fix merged into an integration branch is stamped too. A
// sub-PR into its feature branch names none, and sends nothing (#1409: each event is a run).
import { z } from 'zod';
import { PrNumberSchema, ProductBugIdSchema, type ProductBugId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { proseLines } from '../evaluate/prose-lines.ts';

/** The event `/api/github` sends for a pull request closed, merged or not, or reopened. */
export const FIX_STAMP_EVENT = 'omni-loop/fix.stamp.requested';

/** What happened to the pull request, as `fix_row_stamp()` takes it. */
const FixStampKindSchema = z.enum(['merged', 'closed', 'reopened']);
export type FixStampKind = z.infer<typeof FixStampKindSchema>;

const at = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'a time');

/** The event's data: where, which pull request, what happened to it and when, and the record its body names. */
export const FixStampDataSchema = z.looseObject({
  installationId: z.number(),
  repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'owner/name'),
  prNumber: PrNumberSchema,
  kind: FixStampKindSchema,
  at,
  bug: ProductBugIdSchema.nullable(),
});
export type FixStampData = z.infer<typeof FixStampDataSchema>;

/** One fix stamp event, as the webhook sends it; its `id` makes a redelivery of the same change one run. */
export type FixStampRequest = { name: typeof FIX_STAMP_EVENT; id: string; data: FixStampData };

/** A line that names a bug record born on the server: `Fixes mobile-B74`, at the start of a line. */
const FIXES = /^ {0,3}Fixes ([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-B[1-9]\d{0,9})(?![\w-])/;

/**
 * The bug record a pull request's body says it fixes, or null when it names none. Only a line that
 * starts with `Fixes <key>-B<n>`, outside fenced code, says so, as `Part of <key>-<n>` names a PRD: one
 * quoted in inline code, mid-sentence or in a code block is a mention. The first such line wins.
 */
export function fixedRecordOf(body: string | null | undefined): ProductBugId | null {
  for (const line of proseLines(body ?? '')) {
    const id = FIXES.exec(line)?.[1];
    const parsed = id === undefined ? null : ProductBugIdSchema.safeParse(id);
    if (parsed?.success) return parsed.data;
  }
  return null;
}

/** The event's id: one per pull request, change and time, so a delivery GitHub sends twice runs once. */
export function fixStampId({ repository, prNumber, kind, at: when }: Pick<FixStampData, 'repository' | 'prNumber' | 'kind' | 'at'>): string {
  return `fix-stamp:${repository.toLowerCase()}#${String(prNumber)}:${kind}:${when}`;
}
