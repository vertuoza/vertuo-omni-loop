// `inbox-check`: the Inngest function posting **omni-loop · inbox** on a phase-0 PR (PRD 675).
//
//   step "in-progress"  read the base config; a head branch of the `branches.phase0` shape gets the
//                       check run, `in_progress`, named `ci.inboxContext` — any other PR, and a base
//                       without config, get nothing at all, not even `skipped`
//   step "evaluate"     snapshot the head's inbox, shipped folders and knowledge domains into /tmp, read
//                       the compare and the PRD issue, and let `evaluateInbox` grade the five gates:
//                       the four of the kit, and canon (PRD 839) through `canon`, the spec against the
//                       business of the repository and its product's constituents (PRD 871)
//   step "publish"      complete the check run with the verdict; no comment
//   step "actions"      on a red canon gate only, add its two buttons to the check run (PRD 839):
//                       Rewrite for <persona> and Change the line, which ./canon-action.ts answers
//   onFailure           complete the check run as `failure` with the reason — never left `in_progress`
//
// It listens to the outbox check's event, so every pull request action that re-evaluates the outbox
// check re-evaluates this one, and to its own event, which the webhook sends for a re-run of an inbox
// check run. Debounced per repository and pull request, 3 retries, like the outbox check.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NonRetriableError, type Inngest } from 'inngest';
import { ConfigSchema } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.ts';
import { domainsDir } from 'vertuo-omni-plan/kit/lib/knowledge/registers.ts';
import { CheckRequestDataSchema, inngest, INBOX_CHECK_EVENT, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { installationOctokit, notRetriedPastBound, onFailedRun } from '../outbox-check/outbox-check.ts';
import { readBaseConfig, readPull, type GitHubClient } from '../outbox-check/github.ts';
import { publish } from '../publish/publish.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import { canonFromEnv } from '../canon/live.ts';
import { evaluateInbox, inboxPrd, phase0Topic, type CanonGrader, type InboxVerdict } from './evaluate-inbox.ts';
import { canonActions } from './canon-actions.ts';
import { addCheckActions, compareFacts, completeInboxAsFailure, readIssue, startInboxCheck } from './github.ts';

export const INBOX_FUNCTION_ID = 'inbox-check';

/** `ci.inboxContext` when a repository sets none, taken from the kit's own schema. */
const DEFAULT_INBOX_NAME = ConfigSchema.parse({ kit: 1 }).ci.inboxContext;

/** What a run returns when it posted nothing: not a phase-0 PR, or no loop on this repository. */
const SILENT = Object.freeze({ posted: false, reason: 'not a phase-0 PR of a repository with omni-loop' });

export const INBOX_DEBOUNCE = Object.freeze({
  key: 'event.data.repository + "#" + string(event.data.prNumber)',
  period: '5s',
  timeout: '1m',
});

export function createInboxCheck({ client, octokitFor, canon = null }: { client: Inngest; octokitFor: OctokitFor<GitHubClient>; canon?: CanonGrader | null }) {
  return client.createFunction(
    {
      id: INBOX_FUNCTION_ID,
      name: 'omni-loop · inbox',
      triggers: [{ event: OUTBOX_CHECK_EVENT }, { event: INBOX_CHECK_EVENT }],
      debounce: INBOX_DEBOUNCE,
      retries: 3,
      onFailure: createInboxFailureHandler({ octokitFor }),
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, prNumber, headSha } = CheckRequestDataSchema.parse(event.data);

      const started = await step.run('in-progress', async () => {
        const octokit = await octokitFor(installationId);
        const name = await phase0CheckName(octokit, { owner, repo, prNumber });
        if (name === null) return null;
        const checkRunId = await startInboxCheck(octokit, { owner, repo, headSha, name });
        return { checkRunId, name };
      });
      if (!started) return { ...SILENT };

      const verdict = await step.run('evaluate', () =>
        notRetriedPastBound(async () => evaluateAt(await octokitFor(installationId), { owner, repo, prNumber, headSha, canon })),
      );
      if (!verdict) throw new NonRetriableError('the pull request is no longer a phase-0 PR of this repository');

      await step.run('publish', async () => {
        const octokit = await octokitFor(installationId);
        return publish(octokit, {
          owner,
          repo,
          checkRunId: started.checkRunId,
          pullNumber: prNumber,
          headSha,
          verdict: { conclusion: verdict.conclusion, title: verdict.title, summary: verdict.summary, comment: null },
        });
      });

      const actions = canonActions(verdict.canon);
      if (actions.length > 0) {
        await step.run('actions', async () => {
          const octokit = await octokitFor(installationId);
          await addCheckActions(octokit, { owner, repo, checkRunId: started.checkRunId, actions });
          return actions.map((action) => action.identifier);
        });
      }

      return { checkRunId: started.checkRunId, name: started.name, conclusion: verdict.conclusion, prd: verdict.prd };
    },
  );
}

/**
 * The inbox check's name when the pull request is a phase-0 PR of a repository with the loop, else
 * `null`: its head branch has the `branches.phase0` shape as the base branch's config spells it.
 */
export async function phase0CheckName(
  octokit: GitHubClient,
  { owner, repo, prNumber }: { owner: string; repo: string; prNumber: number },
): Promise<string | null> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const folder = mkdtempSync(join(tmpdir(), 'omni-inbox-name-'));
  try {
    const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha, dest: folder });
    if (!config || phase0Topic(pr.headRef, config.branches.phase0) === null) return null;
    return config.ci.inboxContext;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** The step "evaluate": the base config, the head's folders, the compare and the PRD issue, graded. */
async function evaluateAt(
  octokit: GitHubClient,
  { owner, repo, prNumber, headSha, canon }: { owner: string; repo: string; prNumber: number; headSha: string; canon: CanonGrader | null },
): Promise<InboxVerdict | null> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const base = mkdtempSync(join(tmpdir(), 'omni-inbox-base-'));
  const head = mkdtempSync(join(tmpdir(), 'omni-inbox-head-'));
  try {
    const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha, dest: base });
    const topic = config ? phase0Topic(pr.headRef, config.branches.phase0) : null;
    if (!config || topic === null) return null;

    const ctx = createContext(head, config);
    const { dirs } = ctx.layout;
    await snapshot(octokit, { owner, repo, ref: headSha, paths: [dirs.inbox, dirs.shipped, domainsDir(ctx)], dest: head });
    const prd = inboxPrd({ head, config, topic });
    const issue = prd === null ? null : await readIssue(octokit, { owner, repo, number: prd });
    const { changes, commits } = await compareFacts(octokit, { owner, repo, baseSha: pr.baseSha, headSha });

    return await evaluateInbox({ base, head, pr: { headRef: pr.headRef }, repo: `${owner}/${repo}`, changes, commits, issue, canon });
  } finally {
    rmSync(base, { recursive: true, force: true });
    rmSync(head, { recursive: true, force: true });
  }
}

/**
 * Once the run has failed after its retries, complete the inbox check as `failure` with the reason.
 * A PR that is not a phase-0 PR gets nothing. When GitHub itself fails the handler cannot tell, so it
 * completes an open inbox run of the default name if there is one, and creates none.
 */
export function createInboxFailureHandler({ octokitFor }: { octokitFor: OctokitFor<GitHubClient> }) {
  return onFailedRun(octokitFor, async ({ octokit, request: { owner, repo, prNumber, headSha }, reason }) => {
    let name = DEFAULT_INBOX_NAME;
    let create = false;
    try {
      const phase0 = await phase0CheckName(octokit, { owner, repo, prNumber });
      if (phase0 === null) return { ...SILENT };
      name = phase0;
      create = true;
    } catch {
      name = DEFAULT_INBOX_NAME;
    }
    const checkRunIds = await completeInboxAsFailure(octokit, { owner, repo, headSha, name, reason, create });
    return { checkRunIds, name, reason };
  });
}

export const inboxCheck = createInboxCheck({ client: inngest, octokitFor: installationOctokit, canon: canonFromEnv() });
