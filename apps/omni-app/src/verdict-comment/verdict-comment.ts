// One marked comment on a pull request, kept current (PRD 487): the retro and the knowledge harvest
// each say "nothing worth a PR" in a comment of their own on the merged feature PR. The comment is
// found by its marker and edited in place, or created when there is none, so a replay rewrites it
// and never adds a second. Each caller keeps its own marker: two functions finishing at once never
// edit each other's comment. Their failure hooks (`failureCommentHook`) keep the "could not run" comment the same way.
import type { CommentId, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { listComments } from '../outbox-check/github.ts';
import { CommentWrittenSchema, type GitHubClient } from '../outbox-check/github-schema.ts';
import type { OctokitFor } from '../octokit-for.ts';
import type { z } from 'zod';

/**
 * Creates or rewrites the comment carrying `marker` on pull request `prNumber`. Its body is the
 * marker, then `text`.
 */
export async function upsertComment(
  octokit: GitHubClient,
  { owner, repo, prNumber, marker, text }: { owner: string; repo: string; prNumber: PrNumber; marker: string; text: unknown },
): Promise<{ commentId: CommentId; created: boolean }> {
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
  return { commentId: CommentWrittenSchema.parse(data).id, created: true };
}

/**
 * A kind's failure hook that comments on the merged PR its job's payload names (PRD omni-loop-4: the knowledge
 * harvest's and the retro's): once the job ended failed, one comment, "<what> could not run: <reason>", under
 * `marker`, rewritten in place on a later failure, never a second one. A payload `schema` does not read leaves none.
 */
export function failureCommentHook(
  octokitFor: OctokitFor<GitHubClient>,
  { schema, marker, what }: { schema: z.ZodType<{ installationId: number; owner: string; repo: string; prNumber: PrNumber }>; marker: string; what: string },
): (job: { payload: unknown }, reason: string) => Promise<void> {
  return async (job, reason) => {
    const failed = schema.safeParse(job.payload);
    if (!failed.success) return;
    const { installationId, owner, repo, prNumber } = failed.data;
    await upsertComment(await octokitFor(installationId), { owner, repo, prNumber, marker, text: `${what} could not run: ${reason}` });
  };
}
