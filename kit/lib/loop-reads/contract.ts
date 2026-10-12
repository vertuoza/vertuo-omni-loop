// The loop's read contract (PRD 1665): what the Omni page answers under `<ask.url>/api/loop/*`, in the
// loop's own words (a *change*, never a pull request), as zod schemas. This is the one copy of its
// fields (settled item s1-01): the kit reads with these, and the page builds its own answers' schemas
// from their shapes (its `src/loop/loop.contract.ts`, which may import the kit's library; the kit may
// never import the page, ADR-0058). Both are held to the same examples, the page's
// `src/loop/fixtures/contract.json`, which `./contract.test.ts` reads by its path.
//
// The kit reads, it does not police: every object here keeps the fields it knows and drops the rest,
// so a newer page that answers a field more still reads. The page makes them strict for what it sends.
// Browser-safe: zod and the kit's id schemas only.
import { z } from 'zod';
import { CommentIdSchema, IssueNumberSchema, PrNumberSchema } from '../ids.ts';

/** A change's state: a draft is open but not asked for review; a merged change is closed by its merge. */
const LoopChangeStateSchema = z.enum(['open', 'draft', 'merged', 'closed']);

export const LoopChangeSchema = z.object({
  number: PrNumberSchema,
  title: z.string(),
  head: z.string(),
  base: z.string(),
  state: LoopChangeStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().nullable(),
  labels: z.array(z.string()),
  body: z.string(),
  url: z.string(),
  author: z.string().nullable(),
});
export type LoopChange = z.infer<typeof LoopChangeSchema>;
export type LoopChangeState = LoopChange['state'];

export const LoopChangesSchema = z.object({ changes: z.array(LoopChangeSchema) });

/** A check on a change's head commit: still running, or how it ended. */
export const LoopCheckSchema = z.object({ name: z.string(), state: z.enum(['pending', 'success', 'failure', 'neutral', 'skipped']) });

/** One comment of a review thread. */
export const LoopThreadCommentSchema = z.object({ author: z.string().nullable(), body: z.string(), createdAt: z.string() });

/** A review thread: comments on one line of one file, resolved or not; its id is the host's own, the one
 * a reply to the thread names. */
export const LoopThreadSchema = z.object({
  id: z.string().min(1),
  path: z.string().nullable(),
  line: z.number().int().nullable(),
  resolved: z.boolean(),
  comments: z.array(LoopThreadCommentSchema),
});

/** Where a change's review stands: its head's checks, whether it merges cleanly (null: not known yet),
 * and its review threads. `approvedBy` (PRD 1665, s6) is each person, never a bot, whose last deciding
 * review approves: optional, so a page that does not answer it yet still reads, and its absence reads
 * as nobody, which holds a sub-PR whose flow asks for a person's approval. */
export const LoopReviewSchema = z.object({
  checks: z.array(LoopCheckSchema),
  mergeable: z.boolean().nullable(),
  threads: z.array(LoopThreadSchema),
  approvedBy: z.array(z.string()).optional(),
});

/** What one change adds to a change of a list: when its head was last committed, its paths, its review. */
export const LoopChangeDetailFields = { lastCommitAt: z.string().nullable(), files: z.array(z.string()) };

export const LoopChangeDetailSchema = LoopChangeSchema.extend({ ...LoopChangeDetailFields, review: LoopReviewSchema });
export type LoopChangeDetail = z.infer<typeof LoopChangeDetailSchema>;

/** A comment on an issue's or a change's conversation (not a review thread's). */
export const LoopCommentSchema = z.object({
  id: CommentIdSchema,
  author: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LoopComment = z.infer<typeof LoopCommentSchema>;

export const LoopCommentsSchema = z.object({ comments: z.array(LoopCommentSchema) });

/** An issue (never a change), with its body, which says what it links to. */
export const LoopIssueSchema = z.object({
  number: IssueNumberSchema,
  title: z.string(),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.string()),
  body: z.string(),
});
export type LoopIssue = z.infer<typeof LoopIssueSchema>;

export const LoopIssuesSchema = z.object({ issues: z.array(LoopIssueSchema) });

/** One issue, with its comments, oldest first, and the changes of its own repository that close it. */
export const LoopIssueDetailSchema = LoopIssueSchema.extend({ comments: z.array(LoopCommentSchema), closedBy: z.array(PrNumberSchema) });
export type LoopIssueDetail = z.infer<typeof LoopIssueDetailSchema>;

/** A refusal, in plain words. */
export const LoopErrorSchema = z.object({ error: z.string() });
