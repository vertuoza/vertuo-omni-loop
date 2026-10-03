// What the knowledge harvest reads from outside (PRD 82), as it reads it (PRD 725, s20): its event,
// and GitHub's answers about the merged pull request, a branch, the open pull requests and a commit.
// Each schema names only the fields the harvest uses and lets every other field through.
import { z } from 'zod';
import { ClassificationSchema } from 'vertuo-omni-plan/kit/lib/knowledge/classify.ts';
import { ConfigSchema } from 'vertuo-omni-plan/kit/lib/schema/config.ts';

/** `omni-loop/knowledge.harvest.requested`: where a pull request merged. */
export const HarvestEventSchema = z.looseObject({
  installationId: z.number(),
  owner: z.string(),
  repo: z.string(),
  prNumber: z.number(),
});

/** The same, as the failure handler reads it from the failed run's event: any field may be missing. */
export const FailedHarvestEventSchema = HarvestEventSchema.partial();

/** `GET /repos/{owner}/{repo}/pulls/{pull_number}`: the merge's facts. */
export const PullMergeSchema = z.looseObject({
  merged: z.boolean().nullish(),
  merged_at: z.string().nullish(),
  merged_by: z.looseObject({ login: z.string().nullish() }).nullish(),
  merge_commit_sha: z.string().nullish(),
  html_url: z.string().nullish(),
});

/** `GET /repos/{owner}/{repo}/git/ref/{ref}`: the commit a branch points at. */
export const RefSchema = z.looseObject({ object: z.looseObject({ sha: z.string() }) });

/** One pull request of `GET /repos/{owner}/{repo}/pulls`: its head branch. */
export const OpenPullSchema = z.looseObject({ head: z.looseObject({ ref: z.string().nullish() }).nullish() });

/** `GET /repos/{owner}/{repo}/git/commits/{commit_sha}`: its message. */
export const CommitSchema = z.looseObject({ message: z.string().nullish() });

/**
 * `value` parsed by `schema`, or an error saying what was read and the first field it got wrong:
 * `GitHub answered the pull request unexpectedly: merged_at: …`.
 */
export function parsedOr<S extends z.ZodType>(schema: S, value: unknown, context: string): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  const field = issue && issue.path.length > 0 ? issue.path.join('.') : '(answer)';
  throw new Error(`${context}: ${field}: ${issue?.message ?? parsed.error.message}`);
}

// What the harvest's steps return, read back through these once Inngest has saved them as JSON (PRD
// 1030): a deploy between two replays of a run cannot hand the harvest a value of another shape. Each
// keeps what the harvest reads of the value after its step, and drops the rest.

/** Who merged the feature PR, when, through which pull request: the provenance the harvest writes. */
const MergeSchema = z.object({ by: z.string(), at: z.string(), pr: z.number(), url: z.string().exactOptional() });

/** The step "qualify": a skip, or the merged feature PR's config, PRD and merge. */
export const QualifiedSchema = z.union([
  z.object({ skip: z.string() }),
  z.object({
    skip: z.null(),
    config: ConfigSchema,
    prd: z.object({ number: z.number(), topic: z.string(), title: z.string() }),
    merge: MergeSchema,
  }),
]);

const MoveSchema = z.object({ from: z.string(), to: z.string() });

/** An edit set: deletes, then moves, then writes. */
const EditsSchema = z.object({
  deletes: z.array(z.string()),
  moves: z.array(MoveSchema),
  writes: z.array(z.object({ path: z.string(), text: z.string() })),
});

/** What the prompt reads of a candidate's embedded item: the sections it quotes. */
const ItemSectionsSchema = z.object({
  questionPlain: z.string().nullable().exactOptional(),
  decisionPlain: z.string().nullable().exactOptional(),
  options: z.array(z.object({ letter: z.string(), text: z.string() })).nullable().exactOptional(),
  personSteps: z.string().nullable().exactOptional(),
  whatIHadToDecide: z.string().nullable().exactOptional(),
  whatIDidMeanwhile: z.string().nullable().exactOptional(),
  whatItCostsToChangeLater: z.string().nullable().exactOptional(),
});

/** A settled entry to classify, as the prompt reads it. */
const CandidateSchema = z.object({
  id: z.string(),
  verdict: z.string().nullable(),
  answer: z.string(),
  itemText: z.string(),
  item: z.object({ sections: ItemSectionsSchema.nullable().exactOptional() }).nullable(),
});

/** The knowledge base, as the prompt and the classifier's schema read it. */
const SummarySchema = z.object({
  places: z.object({ adr: z.boolean(), knowledge: z.boolean() }),
  domains: z.array(z.object({ name: z.string(), firstLine: z.string().nullable() })),
  principles: z.array(z.object({ id: z.string(), place: z.string(), statement: z.string() })),
  decisions: z.array(z.object({ number: z.string(), title: z.string().nullable() })),
  laws: z.array(
    z.object({ id: z.string(), kind: z.enum(['principle', 'rule', 'invariant']).nullable(), place: z.string(), statement: z.string() }),
  ),
});

/** The step "settle": the default branch's tip, and the harvest prepared at it. */
export const SettledSchema = z.object({
  tip: z.string(),
  prepared: z.object({
    ok: z.literal(true),
    prd: z.number(),
    edits: EditsSchema,
    settled: z.array(z.object({ id: z.string(), from: z.enum(['open', 'drift']) })),
    shipped: z.array(MoveSchema),
    candidates: z.array(CandidateSchema),
    summary: SummarySchema,
  }),
});

/** A step "classify:<id>": the reply the classifier's schema accepted, or why there is none. */
export const ClassificationOutSchema = z.object({
  id: z.string(),
  reply: ClassificationSchema.nullable(),
  reason: z.string().nullable(),
  error: z.string().nullable(),
});

/** One entry the harvest placed. */
const PlacedSchema = z.object({
  id: z.string(),
  kind: z.enum(['adr', 'invariant', 'rule', 'covered', 'stays-here']),
  landedAs: z.array(z.string()),
  files: z.array(z.string()),
  ledgerFile: z.string(),
  ledgerLine: z.string(),
  decided: z.string(),
  status: z.string().nullable(),
  proposed: z.boolean(),
  reason: z.string(),
});

/** The step "write": the knowledge written, both checks, and the commit that carries it. */
export const WrittenSchema = z.object({
  edits: EditsSchema,
  placed: z.array(PlacedSchema),
  notPlaced: z.array(z.object({ id: z.string(), reason: z.string() })),
  checks: z.object({ knowledge: z.array(z.string()), outbox: z.array(z.string()) }),
  commit: z.object({
    files: z.array(z.object({ path: z.string(), content: z.string() })),
    moves: z.array(MoveSchema),
    deletes: z.array(z.string()),
  }),
  taken: z.array(z.string()),
});

/** The step "publish": the knowledge branch, its commit and its pull request; `null` with nothing to publish. */
export const PublishedSchema = z
  .object({
    branch: z.string(),
    commit: z.string(),
    committed: z.boolean(),
    pr: z.object({ number: z.number(), url: z.string(), created: z.boolean() }),
  })
  .nullable();

/** The step "verdict": the comment left on the merged PR. */
export const CommentedSchema = z.object({ commentId: z.number(), created: z.boolean() });
