// What the knowledge harvest reads from outside (PRD 82), as it reads it (PRD 725, s20): its event,
// and GitHub's answers about the merged pull request, a branch, the open pull requests and a commit.
// Each schema names only the fields the harvest uses and lets every other field through.
import { z } from 'zod';

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
