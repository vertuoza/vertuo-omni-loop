// What GitHub answers the kinds of finding (PRD 725, s21): one schema per answer a kind reads, each
// naming only the fields the kind uses and letting every other field through, since GitHub sends
// many more. A field the kind reads with a fallback is optional here, so an answer the kinds read
// today reads the same; an answer missing what they cannot do without fails, naming that field.
import { z } from 'zod';

/** One issue event: `GET /repos/{owner}/{repo}/issues/{issue_number}/events`. */
export const IssueEventSchema = z.looseObject({
  event: z.string(),
  created_at: z.string(),
  label: z.looseObject({ name: z.string().nullish() }).nullish(),
});

/** One workflow run of `GET /repos/{owner}/{repo}/actions/runs`. */
export const WorkflowRunSchema = z.looseObject({
  id: z.number(),
  name: z.string().nullish(),
  head_sha: z.string().nullish(),
});

/** A page of `GET /repos/{owner}/{repo}/actions/runs`. */
export const WorkflowRunsPageSchema = z.looseObject({ workflow_runs: z.array(WorkflowRunSchema).nullish() });

/** One job of `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`. */
export const JobSchema = z.looseObject({
  id: z.number(),
  run_id: z.number().nullish(),
  workflow_name: z.string().nullish(),
  name: z.string(),
  head_sha: z.string().nullish(),
  run_attempt: z.number().nullish(),
  status: z.string().nullish(),
  conclusion: z.string().nullish(),
  html_url: z.string().nullish(),
  completed_at: z.string().nullish(),
});

/** A page of `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`. */
export const JobsPageSchema = z.looseObject({ jobs: z.array(JobSchema).nullish() });

/** One issue of `GET /repos/{owner}/{repo}/issues`; a pull request carries `pull_request`. */
export const IssueSchema = z.looseObject({
  number: z.number(),
  title: z.string().nullish(),
  body: z.string().nullish(),
  html_url: z.string(),
  created_at: z.string(),
  closed_at: z.string().nullish(),
  pull_request: z.unknown().optional(),
});

/** One pull request of `GET /repos/{owner}/{repo}/pulls`, closed. */
export const ClosedPullSchema = z.looseObject({
  number: z.number(),
  title: z.string().nullish(),
  body: z.string().nullish(),
  html_url: z.string(),
  merged_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  closed_at: z.string().nullish(),
});

/** One file of a pull request or of a commit. */
export const ChangedFileSchema = z.looseObject({
  filename: z.string(),
  previous_filename: z.string().nullish(),
  status: z.string().nullish(),
  additions: z.number().nullish(),
  deletions: z.number().nullish(),
  patch: z.string().nullish(),
});

/** One commit of `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits`. */
export const PullCommitSchema = z.looseObject({
  sha: z.string(),
  parents: z.array(z.unknown()).nullish(),
});

/** A page of `GET /repos/{owner}/{repo}/commits/{ref}`: the commit and some of its files. */
export const CommitPageSchema = z.looseObject({
  html_url: z.string().nullish(),
  files: z.array(ChangedFileSchema).nullish(),
});

/** One comment of `GET /repos/{owner}/{repo}/issues/{issue_number}/comments`. */
export const IssueCommentSchema = z.looseObject({
  body: z.string().nullish(),
  html_url: z.string().nullish(),
  created_at: z.string().nullish(),
});

const UserSchema = z.looseObject({ login: z.string().nullish(), type: z.string().nullish() });

/** One review of `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`. */
export const ReviewSchema = z.looseObject({
  html_url: z.string().nullish(),
  user: UserSchema.nullish(),
  state: z.string().nullish(),
  body: z.string().nullish(),
});

const ThreadCommentSchema = z.looseObject({
  url: z.string().nullish(),
  body: z.string().nullish(),
  author: z.looseObject({ login: z.string().nullish(), __typename: z.string().nullish() }).nullish(),
});

const ReviewThreadSchema = z.looseObject({
  isResolved: z.boolean().nullish(),
  isOutdated: z.boolean().nullish(),
  path: z.string().nullish(),
  comments: z.looseObject({ nodes: z.array(ThreadCommentSchema.nullable()).nullish() }).nullish(),
});

/** What `POST /graphql` answers the review threads query: its data, or the errors GraphQL refused it with. */
export const ReviewThreadsAnswerSchema = z
  .looseObject({
    data: z
      .looseObject({
        repository: z
          .looseObject({
            pullRequest: z
              .looseObject({
                reviewThreads: z
                  .looseObject({
                    pageInfo: z.looseObject({ hasNextPage: z.boolean().nullish(), endCursor: z.string().nullish() }).nullish(),
                    nodes: z.array(ReviewThreadSchema).nullish(),
                  })
                  .nullish(),
              })
              .nullish(),
          })
          .nullish(),
      })
      .nullish(),
    errors: z.array(z.looseObject({ type: z.string().nullish(), message: z.string().nullish() })).nullish(),
  })
  .nullish();

export type IssueEvent = z.infer<typeof IssueEventSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
export type Job = z.infer<typeof JobSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type ClosedPull = z.infer<typeof ClosedPullSchema>;
export type ChangedFile = z.infer<typeof ChangedFileSchema>;
export type PullCommit = z.infer<typeof PullCommitSchema>;
