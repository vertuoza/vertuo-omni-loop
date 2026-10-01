// `publish`: the outbox check's two writes to GitHub.
//
// `startCheck` creates the check run, `in_progress`, on the pull request's head SHA — the first step of
// the `outbox-check` function, so a reviewer sees the check the moment an event lands. `publish` then
// completes that same check run with `evaluate`'s verdict and, on a feature pull request, writes the
// outbox comment `evaluate` planned: rewritten in place by its id, or created when there is none yet.
//
// The comment is left alone when the pull request's head SHA has moved on since the evaluation: a
// newer push has its own run coming, and an older verdict must not overwrite the comment the newer
// one writes. The check run itself is still completed, on the SHA it was created on — it is never left
// `in_progress` (PRD 28, decision 6).
//
// The check's name is `ci.outboxContext`, read by the caller from the base branch's config; with no
// config (an inactive repository) the kit's default applies (decision 10), so the name is the same
// everywhere. The Octokit seam is `octokit.request(route, params)` alone.
import { ConfigSchema } from 'vertuo-omni-plan/kit/lib/config.ts';
import { CreatedSchema, PullHeadSchema, type GitHubClient } from '../outbox-check/github-schema.ts';

/** `ci.outboxContext` when a repository sets none, taken from the kit's own schema. */
export const DEFAULT_CHECK_NAME = ConfigSchema.parse({ kit: 1 }).ci.outboxContext;

/** GitHub's limit on a check run's `output.summary`, in characters. */
export const MAX_SUMMARY = 65535;

const TRUNCATED = '\n\n… (truncated)';

/** A verdict to post: the check run's conclusion and output, and the outbox comment to write, if any. */
export type PublishVerdict = {
  conclusion: string;
  title: string;
  summary: string;
  comment: { id: number | null; body: string } | null;
};

/** How the outbox comment was left. */
export type Published = { checkRunId: number; comment: 'created' | 'updated' | 'head-moved' | 'none' };

/** @returns the check run's id */
export async function startCheck(
  octokit: GitHubClient,
  { owner, repo, headSha, name = DEFAULT_CHECK_NAME }: { owner: string; repo: string; headSha: string; name?: string },
): Promise<number> {
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    status: 'in_progress',
    started_at: new Date().toISOString(),
  });
  return CreatedSchema.parse(data).id;
}

export async function publish(
  octokit: GitHubClient,
  { owner, repo, checkRunId, pullNumber, headSha, verdict }: {
    owner: string;
    repo: string;
    checkRunId: number;
    pullNumber: number;
    headSha: string;
    verdict: PublishVerdict;
  },
): Promise<Published> {
  await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
    owner,
    repo,
    check_run_id: checkRunId,
    status: 'completed',
    conclusion: verdict.conclusion,
    completed_at: new Date().toISOString(),
    output: { title: oneLine(verdict.title), summary: bounded(verdict.summary) },
  });

  if (!verdict.comment) return { checkRunId, comment: 'none' };

  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  });
  const pr = PullHeadSchema.parse(data);
  if (pr.head.sha !== headSha) return { checkRunId, comment: 'head-moved' };

  const { id, body } = verdict.comment;
  if (id === null) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
    return { checkRunId, comment: 'created' };
  }
  await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
    owner,
    repo,
    comment_id: id,
    body,
  });
  return { checkRunId, comment: 'updated' };
}

const oneLine = (title: string): string => title.split('\n')[0] ?? '';

const bounded = (summary: string): string =>
  summary.length <= MAX_SUMMARY ? summary : summary.slice(0, MAX_SUMMARY - TRUNCATED.length) + TRUNCATED;
