// What the retro hands from one step to the next, and keeps in `retro.json`, as zod schemas (PRD 1030,
// s19-01 of PRD 976). Inngest saves each step's value as JSON, and every replay of the run reads it
// back from there: the merge run's values are read again fourteen days later by its day-14 run, maybe
// after a deploy. So each value the retro reads back from a saved step, and each run a `retro.json`
// keeps, is parsed with its schema where it is read (`../saved-step.ts`); a value of another shape
// fails the run, naming the step and the field. The types in `retro.types.ts` are the ones these
// parse to, so the two cannot drift.
import { z } from 'zod';
import { ConfigSchema } from 'vertuo-omni-plan/kit/lib/schema/config.ts';
import { CommentIdSchema, IssueNumberSchema, PrNumberSchema, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { ModelReplySchema } from './narrate.ts';

const text = z.string();
const maybeText = z.string().nullable();

/** The two runs of a retro: at the merge, and fourteen days later. */
export const RunSchema = z.enum(['merge', 'day-14']);

const pullFields = {
  number: PrNumberSchema,
  title: text,
  url: maybeText,
  merged: z.boolean(),
  baseRef: text,
  headRef: text,
  headSha: text,
  openedAt: maybeText,
  mergedAt: maybeText,
  mergeSha: maybeText,
  labels: z.array(text),
};

/** A pull request as the retro reads it (`readPull`). */
export const PullSchema = z.object(pullFields);

/** The merged feature PR once `qualify` kept it: its merge SHA is the one the event named. */
export const FeaturePullSchema = z.object({ ...pullFields, mergeSha: text });

/** A pull request into the feature branch, as the kinds read it (`listPullsInto`). */
export const PullIntoSchema = z.object({
  number: PrNumberSchema,
  title: text,
  url: maybeText,
  state: text,
  draft: z.boolean(),
  headRef: text,
  headSha: text,
  openedAt: text,
  closedAt: maybeText,
  mergedAt: maybeText,
  labels: z.array(text),
});

/** The PRD a feature PR delivered, as `qualify` reads it at the merge. */
export const PrdFactsSchema = z.object({
  number: PrdNumberSchema,
  topic: text,
  title: text,
  problem: text,
  state: z.enum(['shipped', 'inbox']),
  folder: text,
  plan: maybeText,
  settled: maybeText,
});

/** The step "qualify": a skip, or the feature PR kept with its PRD and the config at the merge. */
export const QualifiedSchema = z.union([
  z.object({ skip: z.null(), pr: FeaturePullSchema, prd: PrdFactsSchema, config: ConfigSchema }),
  z.object({ skip: text, pr: PullSchema.exactOptional() }),
]);

/** The step "gather-pulls": the sub-PRs into the feature branch. */
export const PullsIntoSchema = z.array(PullIntoSchema);

/** One link a finding cites; a red run whose log was read also carries its last lines. */
export const EvidenceSchema = z.object({ label: text, url: maybeText, excerpt: text.exactOptional() });

/** A finding as a kind's detector gives it. */
export const FindingSchema = z.object({ id: text, kind: text, title: text, happened: text, evidence: z.array(EvidenceSchema) });

/**
 * A finding on the fact sheet: the kind it came from (`source`) and its rank (`ref`, F1, F2…); in the
 * retro of a multi-repository PRD (PRD 1130), the `owner/name` of the repository it is about.
 */
export const SheetFindingSchema = z.object({ ...FindingSchema.shape, source: text, ref: text, repo: text.exactOptional() });

/**
 * A target of a multi-repository PRD as its step "target-<name>" read it (PRD 1130): through the App's
 * installation there, its feature PRs (one per landing) and the sub-PRs into them; or why not.
 */
export const TargetReadSchema = z.discriminatedUnion('read', [
  z.object({
    name: text,
    repo: text,
    read: z.literal(true),
    installationId: z.number(),
    featurePrs: z.array(FeaturePullSchema).min(1),
    pulls: z.array(PullIntoSchema),
  }),
  z.object({ name: text, repo: text, read: z.literal(false), reason: text }),
]);

/**
 * One repository of a multi-repository PRD's fact sheet, the plan repository first: its feature PRs
 * and, for a target, its kinds' facts (the plan repository's are the sheet's own); or why it was not read.
 */
export const RepositoryFactsSchema = z.object({
  repo: text,
  name: text,
  plan: z.boolean(),
  read: z.boolean(),
  reason: text.exactOptional(),
  featurePrs: z.array(z.object({ number: PrNumberSchema, url: maybeText })),
  kinds: z.record(z.string(), z.unknown()).exactOptional(),
});

/** The rules a run used (`rulesSheet`): their version, the finding order, and every threshold and cap. */
export const RulesSheetSchema = z.object({
  version: z.number(),
  findingOrder: z.array(z.array(text)),
  issuesPerRun: z.number(),
  thresholds: z.object({
    slowSliceFactor: z.number(),
    repeatedRedCommits: z.number(),
    repeatedRedSlices: z.number(),
    failingTestRuns: z.number(),
    churnRangeCommits: z.number(),
    churnFilePercent: z.number(),
    churnFileLines: z.number(),
    afterMergeDays: z.number(),
  }),
  limits: z.object({ logTailLines: z.number(), modelInputTokens: z.number() }),
  fieldCaps: z.object({
    summary: z.number(),
    title: z.number(),
    whyItMatters: z.number(),
    lesson: z.number(),
    reason: z.number(),
    why: z.number(),
  }),
});

const factSheetFields = {
  run: RunSchema,
  rules: RulesSheetSchema,
  prd: z.object({ number: PrdNumberSchema, title: text, topic: text, state: text, folder: text }),
  featurePr: z.object({ number: PrNumberSchema, title: text, url: maybeText, openedAt: maybeText, mergedAt: maybeText, mergeSha: text }),
  /** Each kind's facts, by its id; a reader parses the facts it reads with that kind's schema. */
  kinds: z.record(z.string(), z.unknown()),
  findings: z.array(SheetFindingSchema),
  /** Every repository of a multi-repository PRD (PRD 1130); absent for a PRD of one repository. */
  repositories: z.array(RepositoryFactsSchema).exactOptional(),
};

/** The step "facts": the fact sheet `detect` makes, every number `retro.md` shows. */
export const FactSheetSchema = z.object(factSheetFields);

/** A field `guard` refused, written by `render` as one line naming the reason. */
export const DroppedSchema = z.object({ dropped: text });

/** A prose field: its text, or why it was dropped. */
export const ProseFieldSchema = z.union([text, DroppedSchema]);

/** One finding's prose, as `guard` kept it. */
export const ProseFindingSchema = z.object({
  title: ProseFieldSchema.exactOptional(),
  whyItMatters: ProseFieldSchema.exactOptional(),
  lesson: ProseFieldSchema.exactOptional(),
  keep: z.boolean().exactOptional(),
  why: text.exactOptional(),
});

/** A lesson, and the findings it cites. */
export const LessonSchema = z.object({ text, findings: z.array(text) });

/** The judge's verdict as `guard` kept it, or why it was dropped. */
export const VerdictSchema = z.union([z.object({ worthIt: z.boolean(), reason: text }), DroppedSchema]);

/** The prose `guard` accepted. */
export const ProseSchema = z.object({
  summary: ProseFieldSchema.exactOptional(),
  findings: z.record(z.string(), ProseFindingSchema),
  lessons: z.array(LessonSchema),
  verdict: VerdictSchema.optional(),
});

/** A field `guard` dropped, and why. */
const DroppedFieldSchema = z.object({ field: text, reason: text });

/** The step "guard": the prose kept, and every field dropped. */
export const GuardedSchema = z.object({ prose: ProseSchema.nullable(), dropped: z.array(DroppedFieldSchema) });

/** The step "narrate": the model's reply as `checkReply` passed it, or why there is none. */
export const NarratedSchema = z.object({ model: maybeText, reply: ModelReplySchema.nullable(), reason: maybeText });

/** The narration's outcome, as a run's record keeps it. */
export const NarrationSchema = z.object({ model: maybeText, reason: maybeText, dropped: z.array(DroppedFieldSchema) });

/** One issue a finding was published as. */
export const IssueLinkSchema = z.object({ number: IssueNumberSchema, url: text, state: z.enum(['open', 'closed']) });

/** The step "publish-issues": each published finding's issue, by its id. */
export const IssueLinksSchema = z.record(z.string(), IssueLinkSchema);

/** A run's record, as `retro.json` keeps it: the fact sheet, the narration's outcome, the verdict, the lessons and the issues. */
export const RunRecordSchema = z.object({
  ...factSheetFields,
  narration: NarrationSchema.exactOptional(),
  verdict: VerdictSchema.nullable().exactOptional(),
  lessons: z.array(LessonSchema).exactOptional(),
  issues: IssueLinksSchema.exactOptional(),
});

/** The step "gather-knowledge": the knowledge summary and the lessons of the retros already merged. */
export const KnownSchema = z.object({
  knowledge: z.object({ principles: z.array(z.unknown()), laws: z.array(z.unknown()), decisions: z.array(z.unknown()) }),
  lessons: z.array(text),
});

/** The step "publish": the retro's branch, its commit and its pull request. */
export const PublishedSchema = z.object({
  branch: text,
  committed: z.boolean(),
  commit: text,
  pr: z.object({ number: PrNumberSchema, url: text, created: z.boolean() }).nullable(),
});

/** The step "verdict": the comment kept on the merged feature PR. */
export const CommentedSchema = z.object({ commentId: CommentIdSchema, created: z.boolean() });

/** A step "clock-day-14": the time read, in milliseconds. */
export const ClockSchema = z.number();
