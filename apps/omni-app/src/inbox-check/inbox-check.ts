// `inbox-check`: the check posting **omni-loop · inbox** on a phase-0 PR (PRD 675). It runs as the `pr-inbox`
// job of the ledger (PRD 2688), its steps in order in one try:
//
//   step "in-progress"  read the base config; a head branch of the `branches.phase0` shape gets the
//                       check run, `in_progress`, named `ci.inboxContext` — any other PR, and a base
//                       without config, get nothing at all, not even `skipped`
//   step "evaluate"     snapshot the head's inbox, shipped folders and knowledge domains into /tmp, read
//                       the compare and the PRD issue, and let `evaluateInbox` grade the five gates:
//                       the four of the kit, and canon (PRD 839) through `canon`, the spec against the
//                       business of the repository and its product's constituents (PRD 871); with `laws`
//                       wired, a sixth, `business laws` (PRD 2632), the spec against its product's
//                       business laws through galaxy's signed judge, neutral when it cannot judge
//   step "publish"      complete the check run with the verdict; no comment
//   step "actions"      on a red canon gate only, add its two buttons to the check run (PRD 839):
//                       Rewrite for <persona> and Change the line, which ./canon-action.ts answers
//   failure hook        once the 5th try threw, complete the check run as `failure` with the reason —
//                       never left `in_progress`
//
// Every pull request event the webhook handles refreshes the job, and so does a re-run of an inbox check
// run (its `external_id` is INBOX_EXTERNAL_ID). The worker runs it with the live canon gate, bound to the
// app's environment (../jobs/pr-checks.ts).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { ConfigSchema } from 'omni-loop/kit/lib/config.ts';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import { domainsDir } from 'omni-loop/kit/lib/knowledge/registers.ts';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { checkPayloadOf, PullAtSchema } from '../jobs/payloads.ts';
import type { FailureHook, JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readBaseConfig, readPull, type GitHubClient } from '../outbox-check/github.ts';
import { publish } from '../publish/publish.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import { evaluateInbox, phase0Prds, phase0Topic, type CanonGrader, type InboxVerdict, type IssueFacts, type LawsGrader } from './evaluate-inbox.ts';
import { canonActions } from './canon-actions.ts';
import { addCheckActions, compareFacts, completeInboxAsFailure, readIssue, startInboxCheck } from './github.ts';

/** The kind of the ledger's job running this check (PRD 2688 s3): one per pull request, keyed `<owner/name>#<number>`. */
export const PR_INBOX_KIND = 'pr-inbox';

/** What a `pr-inbox` job needs: the installation, the pull request and its head commit. The payload holds no token (L-GDPR-2). */
type InboxPayload = z.infer<typeof PullAtSchema>;

/** `ci.inboxContext` when a repository sets none, taken from the kit's own schema. */
const DEFAULT_INBOX_NAME = ConfigSchema.parse({ kit: 1 }).ci.inboxContext;

/** Why a job posted nothing: not a phase-0 PR, or no loop on this repository. */
const SILENT_REASON = 'not a phase-0 PR of a repository with omni-loop';

type At = { owner: string; repo: string; prNumber: PrNumber; headSha: string };

/** The step "in-progress": the check run started, or null when the pull request gets no inbox check. */
async function startAt(octokit: GitHubClient, { owner, repo, prNumber, headSha }: At): Promise<{ checkRunId: number; name: string } | null> {
  const name = await phase0CheckName(octokit, { owner, repo, prNumber });
  if (name === null) return null;
  const checkRunId = await startInboxCheck(octokit, { owner, repo, headSha, name });
  return { checkRunId, name };
}

/** The step "publish": the check run completed with the verdict; no comment. */
function publishAt(octokit: GitHubClient, { owner, repo, prNumber, headSha }: At, checkRunId: number, verdict: InboxVerdict) {
  return publish(octokit, {
    owner,
    repo,
    checkRunId,
    pullNumber: prNumber,
    headSha,
    verdict: { conclusion: verdict.conclusion, title: verdict.title, summary: verdict.summary, comment: null },
  });
}

/** The step "actions": the canon buttons added to the check run; their identifiers. */
async function addActionsAt(octokit: GitHubClient, { owner, repo }: At, checkRunId: number, actions: ReturnType<typeof canonActions>): Promise<string[]> {
  await addCheckActions(octokit, { owner, repo, checkRunId, actions });
  return actions.map((action) => action.identifier);
}

/** The job's payload, or the error naming its first malformed field. */
const payloadOf = (raw: unknown): InboxPayload => checkPayloadOf(PullAtSchema, PR_INBOX_KIND, raw);

/**
 * The handler of the `pr-inbox` kind (PRD 2688 s3): the function's steps run in order in one try. A pull
 * request that is not a phase-0 PR of a repository with the loop gets nothing and the job ends `skipped`. A job may
 * run twice: a second run posts a newer check run on the same head commit.
 */
export function inboxHandler({ octokitFor, canon = null, laws = null }: { octokitFor: OctokitFor<GitHubClient>; canon?: CanonGrader | null; laws?: LawsGrader | null }): JobHandler {
  return async (job): Promise<JobResult> => {
    const { installationId, ...where } = payloadOf(job.payload);
    const at: At = where;
    const octokit = await octokitFor(installationId);
    const started = await startAt(octokit, at);
    if (!started) return { outcome: 'skipped', reason: SILENT_REASON };

    const verdict = await evaluateAt(octokit, { ...at, canon, laws });
    if (!verdict) return { outcome: 'skipped', reason: 'the pull request is no longer a phase-0 PR of this repository' };

    await publishAt(octokit, at, started.checkRunId, verdict);
    const actions = canonActions(verdict.canon);
    if (actions.length > 0) await addActionsAt(octokit, at, started.checkRunId, actions);
    return { outcome: 'done' };
  };
}

/** The failure hook of the `pr-inbox` kind: once the job failed on its 5th try, the check completes as `failure`. */
export function inboxFailureHook({ octokitFor }: { octokitFor: OctokitFor<GitHubClient> }): FailureHook {
  return async (job, reason) => {
    const { installationId, ...at } = payloadOf(job.payload);
    await failInbox(await octokitFor(installationId), at, reason);
  };
}

/**
 * The inbox check's name when the pull request is a phase-0 PR of a repository with the loop, else
 * `null`: its head branch has the `branches.phase0` shape as the base branch's config spells it.
 */
export async function phase0CheckName(
  octokit: GitHubClient,
  { owner, repo, prNumber }: { owner: string; repo: string; prNumber: PrNumber },
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
  { owner, repo, prNumber, headSha, canon, laws }: { owner: string; repo: string; prNumber: PrNumber; headSha: string; canon: CanonGrader | null; laws: LawsGrader | null },
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
    const prds = phase0Prds({ head, config, topic });
    const read = await Promise.all(prds.map(async (prd) => [prd, await readIssue(octokit, { owner, repo, number: prd })] as const));
    const issues = new Map<PrdNumber, IssueFacts>(read);
    const issue = (prd: PrdNumber): IssueFacts => issues.get(prd) ?? null;
    const { changes, commits } = await compareFacts(octokit, { owner, repo, baseSha: pr.baseSha, headSha });

    return await evaluateInbox({ base, head, pr: { headRef: pr.headRef }, repo: `${owner}/${repo}`, changes, commits, issue, canon, laws });
  } finally {
    rmSync(base, { recursive: true, force: true });
    rmSync(head, { recursive: true, force: true });
  }
}

/**
 * The failure hook's work: complete the inbox check as `failure` with the reason. A PR that is not a phase-0
 * PR gets nothing. When GitHub itself fails the hook cannot tell, so it completes an open inbox run of the
 * default name if there is one, and creates none.
 */
async function failInbox(octokit: GitHubClient, { owner, repo, prNumber, headSha }: At, reason: unknown): Promise<void> {
  let name = DEFAULT_INBOX_NAME;
  let create = false;
  try {
    const phase0 = await phase0CheckName(octokit, { owner, repo, prNumber });
    if (phase0 === null) return;
    name = phase0;
    create = true;
  } catch {
    name = DEFAULT_INBOX_NAME;
  }
  await completeInboxAsFailure(octokit, { owner, repo, headSha, name, reason, create });
}
