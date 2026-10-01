// One marked comment on a pull request, kept current (PRD 487): the retro and the knowledge harvest
// each say "nothing worth a PR" in a comment of their own on the merged feature PR. The comment is
// found by its marker and edited in place, or created when there is none, so a replay rewrites it
// and never adds a second. Each caller keeps its own marker: two functions finishing at once never
// edit each other's comment.
import { listComments } from '../outbox-check/github.ts';
import { CreatedSchema, type GitHubClient } from '../outbox-check/github-schema.ts';

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
