// What the loop's read routes answer (PRD 1665, s1 and s2; ADR-0095): the facts the kit decides on, in the
// loop's own words (a *change*, never a pull request), as zod schemas. Nothing here is GitHub's: only
// ./github.ts knows the host. Browser-safe: zod and the kit's id schemas only.
//
//   GET /api/loop/changes?repo=<owner/name>&base=<b>|head=<h>|label=<l>&state=all|open
//     → 200 { changes: [Change] }, at most 200, newest first
//   GET /api/loop/changes/<n>?repo=<owner/name>
//     → 200 Change & { lastCommitAt, files: [path], review: { checks, mergeable, threads } }
//   GET /api/loop/comments?repo=<owner/name>&on=<n>
//     → 200 { comments: [Comment] }, oldest first: the conversation of an issue or a change
//   GET /api/loop/issues?repo=<owner/name>&label=<l>&state=all|open|closed
//     → 200 { issues: [Issue] }, at most 200, newest first, never a change
//   GET /api/loop/issues/<n>?repo=<owner/name>
//     → 200 Issue & { comments: [Comment], closedBy: [n] }
//
// Every shape is exampled in ./fixtures/contract.json, which ./loop.contract.test.ts parses here and
// the kit's adapter test reads from the same path: the one truth both sides hold to.
//
// A refusal is `{ error }` in plain words (ADR-0029): 400 a malformed query, 401 no valid sign-in,
// 403 a repository the caller's workspace does not own (checked before any call to the host), 404 no
// such change, 424 the Omni app cannot read the repository (with its install link), 429 the host's
// budget for the repository is spent (saying when it refills), 503 no database or no app here, 500 the
// host failed.
import { z } from 'zod';
import { CommentIdSchema, IssueNumberSchema, PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** The most changes one list answers. */
export const MAX_CHANGES = 200;
/** The most issues one list answers. */
export const MAX_ISSUES = 200;

/** `owner/name`. */
export const RepoSchema = z.string().max(200).regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/, 'owner/name');

/** A change's state: a draft is open but not asked for review; a merged change is closed by its merge. */
const ChangeStateSchema = z.enum(['open', 'draft', 'merged', 'closed']);
export type ChangeState = z.infer<typeof ChangeStateSchema>;

export const ChangeSchema = z.strictObject({
  number: PrNumberSchema,
  title: z.string(),
  head: z.string(),
  base: z.string(),
  state: ChangeStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().nullable(),
  labels: z.array(z.string()),
  body: z.string(),
  url: z.url(),
  author: z.string().nullable(),
});
export type Change = z.infer<typeof ChangeSchema>;

export const ChangesSchema = z.strictObject({ changes: z.array(ChangeSchema).max(MAX_CHANGES) });

/** A check on a change's head commit, in the loop's words: still running, or how it ended. */
const CheckStateSchema = z.enum(['pending', 'success', 'failure', 'neutral', 'skipped']);
export type CheckState = z.infer<typeof CheckStateSchema>;
const CheckSchema = z.strictObject({ name: z.string(), state: CheckStateSchema });
export type Check = z.infer<typeof CheckSchema>;

/** One comment of a review thread. */
const ThreadCommentSchema = z.strictObject({ author: z.string().nullable(), body: z.string(), createdAt: z.string() });

/** A review thread: comments on one line of one file, resolved or not. Its id is the host's own, the one a
 * reply to the thread names. */
const ThreadSchema = z.strictObject({
  id: z.string().min(1),
  path: z.string().nullable(),
  line: z.number().int().nullable(),
  resolved: z.boolean(),
  comments: z.array(ThreadCommentSchema),
});
export type Thread = z.infer<typeof ThreadSchema>;

/** Where a change's review stands: its head's checks, whether it merges cleanly (null: not known yet),
 * and its review threads. */
export const ReviewSchema = z.strictObject({
  checks: z.array(CheckSchema),
  mergeable: z.boolean().nullable(),
  threads: z.array(ThreadSchema),
});

/** One change, with when its head was last committed, the paths it touches and its review. */
export const ChangeDetailSchema = ChangeSchema.extend({
  lastCommitAt: z.string().nullable(),
  files: z.array(z.string()),
  review: ReviewSchema,
});
export type ChangeDetail = z.infer<typeof ChangeDetailSchema>;

/** A list's query: one repository, filtered by any of base, head and label; open only unless `all`. */
export const ChangesQuerySchema = z.strictObject({
  repo: RepoSchema,
  base: z.string().min(1).max(255).optional(),
  head: z.string().min(1).max(255).optional(),
  label: z.string().min(1).max(100).optional(),
  state: z.enum(['all', 'open']).default('open'),
});
export type ChangesQuery = z.infer<typeof ChangesQuerySchema>;

/** A comment on an issue or a change's conversation (not a review thread's). */
const CommentSchema = z.strictObject({
  id: CommentIdSchema,
  author: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const CommentsSchema = z.strictObject({ comments: z.array(CommentSchema) });

/** A number in a query string or a path. */
const NumberParamSchema = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number);

/** The comments' query: one repository, and the issue or change they are on. */
export const CommentsQuerySchema = z.strictObject({ repo: RepoSchema, on: NumberParamSchema.pipe(IssueNumberSchema) });
export type CommentsQuery = z.infer<typeof CommentsQuerySchema>;

const IssueStateSchema = z.enum(['open', 'closed']);

/** An issue (never a change), with its body, which says what it links to. */
export const IssueSchema = z.strictObject({
  number: IssueNumberSchema,
  title: z.string(),
  state: IssueStateSchema,
  labels: z.array(z.string()),
  body: z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const IssuesSchema = z.strictObject({ issues: z.array(IssueSchema).max(MAX_ISSUES) });

/** An issues list's query: one repository, filtered by a label; open only unless `all` or `closed`. */
export const IssuesQuerySchema = z.strictObject({
  repo: RepoSchema,
  label: z.string().min(1).max(100).optional(),
  state: z.enum(['all', 'open', 'closed']).default('open'),
});
export type IssuesQuery = z.infer<typeof IssuesQuerySchema>;

/** One issue, with its comments, oldest first, and the changes of its own repository that close it. */
export const IssueDetailSchema = IssueSchema.extend({
  comments: z.array(CommentSchema),
  closedBy: z.array(PrNumberSchema),
});
export type IssueDetail = z.infer<typeof IssueDetailSchema>;

/** A refusal, in plain words. */
export const LoopRefusalSchema = z.strictObject({ error: z.string() });
