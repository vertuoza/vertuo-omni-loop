// What the CLI reads from `gh api` as JSON, as schemas: an issue's comments, the comment a create or
// an update hands back, and one pull request. Each keeps every other field GitHub sends; a value of
// another shape fails with Zod's error, which names the field.
import { z } from 'zod';

/** One comment of an issue or a pull request (`GET repos/<slug>/issues/<n>/comments`). */
export const GhCommentSchema = z.looseObject({
  id: z.number(),
  body: z.string().nullish(),
  html_url: z.string().nullish(),
});

/** Every comment of an issue or a pull request. */
export const GhCommentsSchema = z.array(GhCommentSchema);

/** The comment `gh` hands back after a create or an update. */
export const GhWrittenCommentSchema = z.looseObject({ id: z.number().nullish(), html_url: z.string().nullish() }).nullish();

/** One pull request (`GET repos/<slug>/pulls/<n>`), the fields the harvest reads. */
export const GhPullRequestSchema = z.looseObject({
  number: z.number(),
  html_url: z.string(),
  merged_at: z.string().nullish(),
  merged_by: z.looseObject({ login: z.string() }).nullish(),
  merge_commit_sha: z.string().nullish(),
  base: z.looseObject({ ref: z.string() }).nullish(),
  head: z.looseObject({ ref: z.string() }).nullish(),
});

/** One pull request of `gh pr list --json …`, the fields the board reads; each may be missing. */
export const GhPrListItemSchema = z.looseObject({
  number: z.number().optional(),
  title: z.string().optional(),
  headRefName: z.string().optional(),
  baseRefName: z.string().optional(),
  state: z.string().optional(),
  isDraft: z.boolean().optional(),
  mergedAt: z.string().nullish(),
  body: z.string().optional(),
  labels: z.array(z.union([z.string(), z.looseObject({ name: z.string().nullish() })]).nullish()).nullish(),
  updatedAt: z.string().optional(),
  createdAt: z.string().nullish(),
});

/** What `gh pr list --json …` prints: every pull request it found. */
export const GhPrListSchema = z.array(GhPrListItemSchema);

/** What `gh pr list --json number,state,updatedAt` prints: the feature branch's pull requests. */
export const GhPrStatesSchema = z.array(z.looseObject({ number: z.number(), state: z.string().optional(), updatedAt: z.unknown().optional() }));

/** Any answer of `gh api graphql`: its data, read by the caller, and the errors GitHub gave. */
export const GhGraphqlSchema = z.looseObject({
  data: z.unknown().optional(),
  errors: z.array(z.looseObject({ message: z.string() })).nullish(),
});

/** The answer to the care reply's mutation: the posted comment's URL. */
export const GhReplyMutationSchema = z.looseObject({
  data: z
    .looseObject({
      addPullRequestReviewThreadReply: z
        .looseObject({ comment: z.looseObject({ url: z.string().nullish() }).nullish() })
        .nullish(),
    })
    .nullish(),
});

/** What `gh pr view <n> --json commits` prints: the pull request's commits, oldest first. */
export const GhPrCommitsSchema = z.looseObject({
  commits: z.array(z.looseObject({ committedDate: z.string().nullish(), authoredDate: z.string().nullish() })).nullish(),
});
