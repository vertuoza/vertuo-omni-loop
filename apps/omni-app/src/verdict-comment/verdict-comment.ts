// One marked comment on a pull request, kept current (PRD 487): the retro and the knowledge harvest
// each say "nothing worth a PR" in a comment of their own on the merged feature PR. The comment is
// found by its marker and edited in place, or created when there is none, so a replay rewrites it
// and never adds a second. Each caller keeps its own marker: two functions finishing at once never
// edit each other's comment.
import { listComments } from '../outbox-check/github.ts';
import { CreatedSchema, type GitHubClient } from '../outbox-check/github-schema.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { savedStep, type StepRun } from '../saved-step.ts';
import { z } from 'zod';

/**
 * Creates or rewrites the comment carrying `marker` on pull request `prNumber`. Its body is the
 * marker, then `text`.
 */
export async function upsertComment(
  octokit: GitHubClient,
  { owner, repo, prNumber, marker, text }: { owner: string; repo: string; prNumber: number; marker: string; text: unknown },
): Promise<{ commentId: number; created: boolean }> {
  const body = `${marker}\n${String(text).trimEnd()}\n`;
  const comments = await listComments(octokit, { owner, repo, prNumber });
  const existing = comments.find((comment) => comment.body.includes(marker));
  if (existing) {
    await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    return { commentId: existing.id, created: false };
  }
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
  return { commentId: CreatedSchema.parse(data).id, created: true };
}

/** What a failed run's event names of its merged PR: the installation and the repository. */
type FailedMerge = { installationId: number; owner?: string | undefined; repo?: string | undefined };

/** What a failure handler's comment step returns: the comment, the reason it gives, and whether it is new. */
export const FailureCommentSchema = z.object({ commentId: z.number(), reason: z.string(), created: z.boolean() });

/** The step a failure handler comments in. */
const COMMENT_FAILURE_STEP = 'comment-failure';

/**
 * A failure handler's comment on the merged PR: `comment` runs with the installation's GitHub and the
 * PR's repository, in the step "comment-failure" (or directly, when it is called without steps), and
 * what it returns is read back through `schema`. A failure event that names no repository fails, as
 * the GitHub call it would have made always has.
 */
export function commentOnFailure<Client, T>(
  octokitFor: OctokitFor<Client>,
  step: Partial<StepRun> | null | undefined,
  { installationId, owner, repo }: FailedMerge,
  schema: z.ZodType<T>,
  comment: (octokit: Client, where: { owner: string; repo: string }) => Promise<T>,
): Promise<T> {
  const run = async (): Promise<T> => {
    if (!owner || !repo) throw new Error('The failed run names no repository to comment on');
    return comment(await octokitFor(installationId), { owner, repo });
  };
  return step?.run ? savedStep({ run: step.run }, COMMENT_FAILURE_STEP, schema, run) : run();
}
