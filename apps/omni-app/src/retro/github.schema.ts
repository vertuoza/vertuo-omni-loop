// What the retro reads from GitHub, and back from a `retro.json` on a branch, as Zod schemas parsed
// before use (PRD 725, s22). Each is as loose as the reader always was: a field the reader fills in
// when it is missing may be missing or null; what it reads as is stays required. A field missing or
// of the wrong type fails, naming it.
import { z } from 'zod';
import { parseOrThrow } from 'vertuo-omni-plan/kit/lib/schema/parse-or-throw.ts';

const label = z.union([z.string(), z.object({ name: z.string() })]);

/** One pull request, as `GET /repos/{owner}/{repo}/pulls/{pull_number}` and the pulls list answer it. */
export const PullSchema = z.object({
  number: z.number(),
  title: z.string().nullish(),
  html_url: z.string().nullish(),
  state: z.string().nullish(),
  draft: z.boolean().nullish(),
  merged: z.boolean().nullish(),
  base: z.object({ ref: z.string() }),
  head: z.object({ ref: z.string(), sha: z.string() }),
  created_at: z.string().nullish(),
  closed_at: z.string().nullish(),
  merged_at: z.string().nullish(),
  merge_commit_sha: z.string().nullish(),
  labels: z.array(label).nullish(),
});

/** A page of any list route, its items left for the reader to parse once the pages are read. */
export const ListSchema = z.array(z.unknown());

/** A page of `GET /repos/{owner}/{repo}/pulls`: each with its state and when it was opened. */
export const PullsSchema = z.array(PullSchema.extend({ state: z.string(), created_at: z.string() }));

/** A page of `GET /repos/{owner}/{repo}/pulls?head=…`, as the retro looks for its own PR. */
export const RetroPullsSchema = z.array(z.object({ number: z.number(), state: z.string(), html_url: z.string() }));

/** `GET /repos/{owner}/{repo}/git/trees/{tree_sha}`. */
export const TreeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string(), sha: z.string() })),
});

/** `GET /repos/{owner}/{repo}/contents/{path}`: a folder's entries, or one entry. */
export const ContentSchema = z.union([
  z.array(z.unknown()),
  z.object({ type: z.string(), content: z.string().nullish(), encoding: z.string().nullish() }),
]);

/** `GET /repos/{owner}/{repo}/git/blobs/{file_sha}`. */
export const BlobSchema = z.object({ content: z.string().nullish(), encoding: z.string().nullish() });

/** `GET /repos/{owner}/{repo}/git/ref/{ref}`. */
export const RefSchema = z.object({ object: z.object({ sha: z.string() }) });

/** A page of `GET /repos/{owner}/{repo}/issues`. */
export const IssuesSchema = z.array(
  z.object({
    number: z.number(),
    html_url: z.string(),
    state: z.string(),
    title: z.string(),
    body: z.string().nullish(),
    pull_request: z.unknown().optional(),
  }),
);

/** The issue `POST /repos/{owner}/{repo}/issues` opened. */
export const CreatedIssueSchema = z.object({ number: z.number(), html_url: z.string() });

/** The comment `POST /repos/{owner}/{repo}/issues/{issue_number}/comments` wrote. */
export const CreatedCommentSchema = z.object({ id: z.number() });

/**
 * A `retro.json` read back from a branch: its runs, kept as they were written. A file whose `runs`
 * is not a list holds none, as the reader always treated it.
 */
export const RetroDocSchema = z.object({ runs: z.array(z.unknown()).catch([]) }).catch({ runs: [] });

/** A run of a `retro.json` read back for its lessons: a lesson that is not one is left out by the reader. */
export const RetroLessonsSchema = z
  .object({ lessons: z.array(z.object({ text: z.unknown() }).catch({ text: null })).catch([]) })
  .catch({ lessons: [] });

/**
 * `value`, as GitHub answered `route`, parsed by `schema`; else an error naming the first field that
 * is wrong: `GET /repos/{owner}/{repo}/pulls answered an unexpected shape: 0.number: …`.
 */
export function parseGitHub<S extends z.ZodType>(schema: S, value: unknown, route: string): z.infer<S> {
  return parseOrThrow(schema, value, `${route} answered an unexpected shape`);
}
