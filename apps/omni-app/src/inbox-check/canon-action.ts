// @ts-nocheck
// `canon-action`: the Inngest function answering a click of a canon button (PRD 839).
//
//   step "comment"  on a phase-0 PR of a repository with the loop only, post the button's one comment
//                   (./canon-actions.ts): Rewrite for <persona> posts the rework command, Change the
//                   claim links to the claim on Settings › Business. A comment of the same button
//                   already on the PR is edited, never doubled. Any other PR gets nothing.
//
// It runs on the event the webhook sends for a click, one click at a time per pull request, so a
// double click cannot post twice. Galaxy's host is `GALAXY_URL` when set, as for the stage events.
import { inngest } from '../inngest-client.ts';
import { installationOctokit } from '../outbox-check/outbox-check.ts';
import { listComments } from '../outbox-check/github.ts';
import { stageEventUrl } from '../stage-forward/stage-forward.ts';
import { CANON_ACTION_EVENT, canonComment, commentMarker } from './canon-actions.ts';
import { phase0CheckName } from './inbox-check.ts';

export const CANON_ACTION_FUNCTION_ID = 'canon-action';

/** Galaxy's host: `GALAXY_URL` when set, else its production domain. */
const galaxyHost = () => new URL(stageEventUrl()).origin;

/**
 * @param {{
 *   client: import('inngest').Inngest,
 *   octokitFor: (installationId: number) => Promise<{ request: Function }> | { request: Function },
 *   galaxyUrl?: string,
 * }} deps
 */
export function createCanonAction({ client, octokitFor, galaxyUrl }) {
  return client.createFunction(
    {
      id: CANON_ACTION_FUNCTION_ID,
      name: 'omni-loop · canon action',
      triggers: [{ event: CANON_ACTION_EVENT }],
      concurrency: { key: 'event.data.repository + "#" + string(event.data.prNumber)', limit: 1 },
      retries: 3,
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, prNumber, action, facts } = event.data;
      return step.run('comment', async () => {
        const body = canonComment(action, facts, { galaxyUrl: galaxyUrl ?? galaxyHost() });
        if (body === null) return { posted: false, reason: `not a canon button: ${action}` };

        const octokit = await octokitFor(installationId);
        if ((await phase0CheckName(octokit, { owner, repo, prNumber })) === null) {
          return { posted: false, reason: 'not a phase-0 PR of a repository with omni-loop' };
        }
        const marker = commentMarker(action);
        const mine = (await listComments(octokit, { owner, repo, prNumber })).find((comment) => comment.body.includes(marker));
        if (mine) {
          await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', { owner, repo, comment_id: mine.id, body });
          return { posted: true, comment: 'updated', id: mine.id };
        }
        const { data } = await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner,
          repo,
          issue_number: prNumber,
          body,
        });
        return { posted: true, comment: 'created', id: data.id };
      });
    },
  );
}

export const canonAction = createCanonAction({ client: inngest, octokitFor: installationOctokit });
