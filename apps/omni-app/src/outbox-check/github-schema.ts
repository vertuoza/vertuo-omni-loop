// What the app's units read back from GitHub's REST API, one schema per answer, and the one Octokit
// seam they all call it through. Every answer is parsed before it is read, so a GitHub that answers
// in another shape fails by the name of the field, not with an `undefined` three calls later. Each
// schema names only the fields the units read; GitHub's other fields pass through untouched.
import { z } from 'zod';

/**
 * The one seam every unit calls GitHub through: `octokit.request(route, params)`. Every Octokit
 * carries it, the installation client `@octokit/app` hands out included, so a test stubs one function.
 */
export type GitHubClient = {
  request: (route: string, params?: Record<string, unknown>) => Promise<{ data: unknown }>;
};

/** The repository a call is about. */
export type Repo = { owner: string; repo: string };

const Label = z.union([z.string(), z.looseObject({ name: z.string().nullish() })]);

/** A label's name, whether GitHub hands the label or its name. */
export const labelName = (label: z.infer<typeof Label>): string | undefined =>
  typeof label === 'string' ? label : (label.name ?? undefined);

/** `GET /repos/{owner}/{repo}/pulls/{pull_number}`. */
export const PullSchema = z.looseObject({
  base: z.looseObject({ ref: z.string(), sha: z.string() }),
  head: z.looseObject({ ref: z.string(), sha: z.string() }),
  labels: z.array(Label).nullish(),
});

/** The same answer, where only its head is read. */
export const PullHeadSchema = z.looseObject({ head: z.looseObject({ sha: z.string() }) });

/** `GET /repos/{owner}/{repo}/issues/{issue_number}`. */
export const IssueSchema = z.looseObject({
  state: z.string(),
  labels: z.array(Label).nullish(),
  pull_request: z.unknown().optional(),
});

/** Anything GitHub created or wrote: a check run, a comment. */
export const CreatedSchema = z.looseObject({ id: z.number() });

/** One page of `GET /repos/{owner}/{repo}/issues/{issue_number}/comments`. */
export const CommentsPageSchema = z.array(z.looseObject({ id: z.number(), body: z.string().nullish() }));

/** One page of `GET /repos/{owner}/{repo}/compare/{basehead}`. */
export const ComparePageSchema = z.looseObject({
  files: z.array(z.looseObject({ filename: z.string(), status: z.string() })).nullish(),
  commits: z
    .array(z.looseObject({ sha: z.string(), commit: z.looseObject({ message: z.string().nullish() }).nullish() }))
    .nullish(),
});

/** `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`. */
export const CheckRunsSchema = z.looseObject({
  check_runs: z.array(z.looseObject({ id: z.number(), status: z.string().nullish() })).nullish(),
});

/** One entry of a Git tree. */
const TreeEntrySchema = z.looseObject({
  path: z.string(),
  mode: z.string(),
  type: z.string(),
  sha: z.string(),
  size: z.number().nullish(),
});
export type TreeEntry = z.infer<typeof TreeEntrySchema>;

/** `GET /repos/{owner}/{repo}/git/trees/{tree_sha}`. */
export const TreeSchema = z.looseObject({ truncated: z.boolean().nullish(), tree: z.array(TreeEntrySchema) });

/** `GET /repos/{owner}/{repo}/git/blobs/{file_sha}`. */
export const BlobSchema = z.looseObject({ content: z.string(), encoding: z.string().nullish() });

/** `GET /repos/{owner}/{repo}/git/ref/{ref}`. */
export const RefSchema = z.looseObject({ object: z.looseObject({ sha: z.string() }) });

/** `GET /repos/{owner}/{repo}/git/commits/{commit_sha}`. */
export const GitCommitSchema = z.looseObject({ tree: z.looseObject({ sha: z.string() }) });

/** A Git object GitHub wrote: a tree, a commit. */
export const ShaSchema = z.looseObject({ sha: z.string() });

/** A pull request GitHub opened or rewrote. */
export const PullWrittenSchema = z.looseObject({ number: z.number(), html_url: z.string() });

/** `GET /repos/{owner}/{repo}/pulls`: the pull requests from a branch. */
export const PullsSchema = z.array(
  z.looseObject({
    number: z.number(),
    html_url: z.string(),
    state: z.string(),
    merged_at: z.string().nullish(),
    head: z.looseObject({ sha: z.string().nullish() }).nullish(),
  }),
);
export type PullListed = z.infer<typeof PullsSchema>[number];

/** What a failed request carries: its message, and GitHub's status. */
const FailureSchema = z.looseObject({ status: z.unknown(), message: z.unknown() }).partial();

/** The HTTP status a failed request carries, or `undefined`. */
export function statusOf(error: unknown): unknown {
  const read = FailureSchema.safeParse(error);
  return read.success ? read.data.status : undefined;
}

/** The message a thrown value carries (`error?.message`), or `undefined`. */
export function messageField(error: unknown): unknown {
  const read = FailureSchema.safeParse(error);
  return read.success ? read.data.message : undefined;
}

/** An error's message, or the value itself when it carries none (`error?.message ?? error`). */
export function messageOf(error: unknown): unknown {
  return messageField(error) ?? error;
}
