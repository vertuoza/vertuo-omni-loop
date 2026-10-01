// What `omni credits` reads from `gh` (PRD #99), as Zod schemas, parsed before use (PRD 725, s14).
// Each is as loose as the reader always was: a field the reader fills when it is missing may be
// missing or null. What it keys a row by (a row's number and repository, a commit's sha and
// repository) is required. A field missing or of the wrong type fails, naming it.
import { z } from 'zod';
import { KIT_MESSAGES } from '../schema/messages.ts';

const named = z.object({ name: z.string() });
const login = z.object({ login: z.string().nullish() });

/** One pull request or issue as `gh pr view --json` prints it. */
export const ViewedPullRequestSchema = z.object({
  number: z.number(),
  title: z.string().nullish(),
  state: z.string().nullish(),
  createdAt: z.string().nullish(),
  labels: z.array(named).nullish(),
  body: z.string().nullish(),
  author: login.nullish(),
});

/** One pull request or issue as `gh search prs --json` and `gh search issues --json` print it. */
const SearchedItemSchema = ViewedPullRequestSchema.extend({
  repository: z.object({ nameWithOwner: z.string() }),
});
export const SearchedItemsSchema = z.array(SearchedItemSchema);

/** One commit as `gh search commits --json sha,commit,repository` prints it. */
const SearchedCommitSchema = z.object({
  sha: z.string(),
  commit: z
    .object({
      message: z.string().nullish(),
      committer: z.object({ date: z.string().nullish() }).nullish(),
    })
    .nullish(),
  repository: z.object({ fullName: z.string() }),
});
export const SearchedCommitsSchema = z.array(SearchedCommitSchema);

export type ViewedPullRequest = z.infer<typeof ViewedPullRequestSchema>;

/**
 * `value`, as `what` printed it, parsed by `schema`; else an error naming the first field that is
 * wrong: `gh search prs printed an unexpected shape: 0.number: Expected number, received string`.
 */
export function parseGh<S extends z.ZodType>(schema: S, value: unknown, what: string): z.infer<S> {
  const parsed = schema.safeParse(value, { error: KIT_MESSAGES });
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue && issue.path.length ? `${issue.path.join('.')}: ` : '';
  throw new Error(`${what} printed an unexpected shape: ${field}${issue?.message ?? 'invalid'}`);
}
