// `canon-action` as a job of the ledger (PRD omni-loop-3 s4; PRD 839): what the `canonAction` Inngest function did,
// moved over. `/api/github` adds one job for a click of a canon button (../webhook/webhook.ts), keyed by the
// delivery's id, so a delivery GitHub sends twice is one job and two clicks are two; in the lane
// `<owner/name>#<pr>`, lower case, so two clicks on one pull request never run together and a double click cannot
// post twice; with 4 tries. Its payload is the click (installation, pull request, button, the facts the check
// run's summary hid), never a token (L-GDPR-2). A run:
//
//   comment   on a phase-0 PR of a repository with the loop only, posts the button's one comment
//             (./canon-actions.ts): Rewrite for <persona> posts the rework command, Change the claim links to the
//             claim on Settings › Business. A comment of the same button already on the PR is edited, never
//             doubled, so a second run is harmless. Any other PR gets nothing: the job ends `skipped`, with why.
//
// It adds its own comment and edits only that one: never a comment a person wrote (BL-ASK-1). Galaxy's host is the
// app's `galaxyUrl` (`GALAXY_URL` or its default, ../env.ts), as for the stage events. A GitHub error throws, and
// the worker retries the job (../jobs/worker.ts).
import { CanonActionRequestDataSchema, type CanonActionRequestData } from '../inngest-client.ts';
import type { NewJob } from '../jobs/ledger.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { listComments, type GitHubClient } from '../outbox-check/github.ts';
import { canonComment, commentMarker } from './canon-actions.ts';
import { phase0CheckName } from './inbox-check.ts';

export const CANON_ACTION_KIND = 'canon-action';

/** A click's tries: the 4th that throws fails it. */
const MAX_TRIES = 4;

/** The job of one click, keyed by the delivery that carried it, in its pull request's lane. */
export function canonActionJob(delivery: string, data: CanonActionRequestData): NewJob {
  const subject = data.repository.toLowerCase();
  const { installationId, owner, repo, repository, prNumber, headSha, checkRunId, action, facts } = data;
  return {
    kind: CANON_ACTION_KIND,
    key: delivery,
    subject,
    payload: {
      installationId,
      owner,
      repo,
      repository,
      prNumber,
      action,
      facts,
      ...(headSha === undefined ? {} : { headSha }),
      ...(checkRunId === undefined ? {} : { checkRunId }),
    },
    lane: `${subject}#${String(prNumber)}`,
    maxTries: MAX_TRIES,
  };
}

/** The handler of the `canon-action` kind. */
export function canonActionHandler({ octokitFor, galaxyUrl }: { octokitFor: OctokitFor<GitHubClient>; galaxyUrl: string }): JobHandler {
  return async (job): Promise<JobResult> => {
    const { installationId, owner, repo, prNumber, action, facts } = CanonActionRequestDataSchema.parse(job.payload);
    const body = canonComment(action, facts, { galaxyUrl });
    if (body === null) return { outcome: 'skipped', reason: `not a canon button: ${action}` };

    const octokit = await octokitFor(installationId);
    if ((await phase0CheckName(octokit, { owner, repo, prNumber })) === null) {
      return { outcome: 'skipped', reason: 'not a phase-0 PR of a repository with omni-loop' };
    }
    const marker = commentMarker(action);
    const mine = (await listComments(octokit, { owner, repo, prNumber })).find((comment) => comment.body.includes(marker));
    if (mine) {
      await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', { owner, repo, comment_id: mine.id, body });
      return { outcome: 'done' };
    }
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { owner, repo, issue_number: prNumber, body });
    return { outcome: 'done' };
  };
}
