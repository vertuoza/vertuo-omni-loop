// What each kind's `gather` returns (PRD 1030, s19-01 of PRD 976), as zod schemas: the records of a
// step "gather-<kind>", which Inngest saves as JSON and the run reads back before `detect` is given
// them. Each kind's `Records` type is the one its schema parses to, so the two cannot drift; a saved
// record of another shape, as after a deploy between the merge run and the day-14 run, fails the run,
// naming the step and the field. A field a kind may leave undefined is optional here, as JSON has no
// undefined to keep.
import { z } from 'zod';
import { IssueNumberSchema, PrNumberSchema, SliceIdSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

const text = z.string();
const maybeText = z.string().nullable();

/** A change block, as `changeBlocks` reduces a patch: old start, old count, new start, new count. */
const BlockSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

// ── timeline ─────────────────────────────────────────────────────────────────────────────────────

/** The timeline kind: when the feature PR was marked ready. */
export const TimelineRecordsSchema = z.object({ readyAt: maybeText });

// ── delivery ─────────────────────────────────────────────────────────────────────────────────────

/** A stuck slice's status comment. */
export const StuckCommentSchema = z.object({ url: maybeText, at: maybeText, attempts: z.number(), text: z.string().nullish() });

/** One review of a pull request. */
export const ReviewRecordSchema = z.object({
  url: maybeText,
  author: maybeText,
  bot: z.boolean(),
  state: maybeText,
  red: z.boolean(),
  text: z.string().nullish(),
});

/** One review thread of a pull request. */
export const ThreadRecordSchema = z.object({
  url: maybeText,
  author: maybeText,
  bot: z.boolean(),
  path: maybeText,
  resolved: z.boolean(),
  outdated: z.boolean(),
  red: z.boolean(),
  text: maybeText,
});

/** What the delivery kind read of one pull request; `null` where GitHub would not say, missing where it was not asked. */
export const PullReadsSchema = z.object({
  files: z.array(text).nullable().exactOptional(),
  stuck: z.array(StuckCommentSchema).nullable().exactOptional(),
  needsFix: z.array(text).nullable().exactOptional(),
  reviews: z.array(ReviewRecordSchema).nullable().exactOptional(),
  threads: z.array(ThreadRecordSchema).nullable().exactOptional(),
});

/** The delivery kind: its reads, by pull request number. */
export const DeliveryRecordsSchema = z.object({ pulls: z.record(z.string(), PullReadsSchema.optional()) });

// ── ci ───────────────────────────────────────────────────────────────────────────────────────────

/** One job of one run, as the ci kind keeps it. */
export const JobRecordSchema = z.object({
  id: z.number(),
  run: z.number(),
  workflow: maybeText,
  check: text,
  slice: SliceIdSchema,
  sha: z.string().nullish(),
  attempt: z.number(),
  status: z.string().nullish(),
  conclusion: maybeText,
  url: maybeText,
  completedAt: maybeText,
});

/** The ci kind: the slices read, what GitHub would not let it read, every job, and each red job's log. */
export const CiRecordsSchema = z.object({
  slices: z.array(SliceIdSchema),
  unread: z.array(z.object({ slice: SliceIdSchema, run: z.number().exactOptional(), status: z.number() })),
  jobs: z.array(JobRecordSchema),
  logs: z.record(z.string(), z.object({ tail: maybeText, status: z.number().exactOptional() }).optional()),
});

// ── churn ────────────────────────────────────────────────────────────────────────────────────────

/** One file of a commit, its patch reduced to change blocks. */
const CommitFileSchema = z.object({
  path: text,
  previous: maybeText,
  status: z.string().nullish(),
  additions: z.number(),
  deletions: z.number(),
  blocks: z.array(BlockSchema).nullable(),
});

/** One pull request merged into the feature branch, and its commits. */
const PullRecordSchema = z.object({
  number: PrNumberSchema,
  url: maybeText,
  headRef: text,
  mergedAt: maybeText,
  commits: z.array(z.object({ sha: text, url: maybeText, files: z.array(CommitFileSchema).nullable() })).nullable(),
});

/** The churn kind: `.gitattributes` at the merge, the final diff's files, and every merged pull request's commits. */
export const ChurnRecordsSchema = z.object({
  gitattributes: maybeText,
  final: z.array(z.object({ path: text, additions: z.number().nullish(), deletions: z.number().nullish() })).nullable(),
  pulls: z.array(PullRecordSchema),
});

// ── after-merge ──────────────────────────────────────────────────────────────────────────────────

/** A line range of a file. */
const RangeSchema = z.object({ path: text, from: z.number(), to: z.number() });

/** The after-merge kind: the window, the bugs and their fixes, the merge commit's jobs and the merge run's churn ranges. */
export const AfterMergeRecordsSchema = z.object({
  window: z.object({ from: text, to: text }),
  bugs: z.array(z.object({ number: IssueNumberSchema, url: text, createdAt: text, closedAt: maybeText })),
  fixes: z.array(
    z.object({
      number: PrNumberSchema,
      url: text,
      mergedAt: text,
      closes: z.array(IssueNumberSchema),
      files: z.array(z.object({ path: text, previous: maybeText, blocks: z.array(BlockSchema).nullable() })).nullable(),
    }),
  ),
  checks: z.object({
    commit: text,
    status: z.number().nullable(),
    jobs: z.array(z.object({ name: text, workflow: maybeText, conclusion: maybeText, url: maybeText })),
  }),
  ranges: z.array(RangeSchema),
  unread: z.array(
    z.object({ read: z.enum(['bugs', 'fixes', 'files', 'jobs']), pr: PrNumberSchema.exactOptional(), run: z.number().exactOptional(), status: z.number() }),
  ),
});

/** What the day-14 run reads back of the merge run's churn facts: the ranges it found, when it found any. */
export const ChurnAtMergeSchema = z.object({ ranges: z.array(RangeSchema).exactOptional() }).nullish();
