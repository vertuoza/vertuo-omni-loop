// `budgets-check`: the check posting **omni / budgets** on each pull request of a repository whose
// `budgets.context.enabled` is true (PRD 1679 s3): whether what every agent session reads stayed under its
// ceilings, the verdict `omni check context` gives in a checkout. It runs as the `pr-budgets` job of the
// ledger (PRD 2688, ./job.ts), its three stages in order in one try:
//
//   "target"   read the pull request and its base branch's config: a base without the loop's config,
//              a config that does not parse, or one with budgets off, gets nothing at all, not even
//              `skipped` (acceptance 7)
//   "measure"  snapshot the head and the base, measure, judge and write the output (./measure-pull.ts)
//   "publish"  post the check run completed: `failure` on a red, `success` within budget, `neutral`
//              when something could not be measured, which never blocks a merge (D6)
//   failure    once the 5th try threw, post it `neutral`, saying why: a check that cannot run never
//              blocks a merge either (`postNotMeasured`)
//
// Every pull request event the webhook handles refreshes the job, and so does the server event's re-check
// of a product PRD's pull requests: an `item-settled` that answers a raise posts it again, green, with no new
// push (../server-event/recheck.ts). A re-run of a budgets check run (its `external_id` is
// BUDGETS_EXTERNAL_ID) refreshes it too.
//
// The installation's GitHub budget is shared with galaxy (PRD 902): a call the budget refuses, paused or
// deferred, is never sent; it is thrown, and the worker reads it as `waiting`.
import { contextBudget } from 'omni-loop/kit/lib/config.ts';
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { BUDGETS_EXTERNAL_ID } from '../jobs/payloads.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readBaseConfig, readPull, type GitHubClient, type PullFacts, type Repo } from '../outbox-check/github.ts';
import { CreatedSchema, firstLine } from '../outbox-check/github-schema.ts';
import { measurePull } from './measure-pull.ts';
import { BUDGETS_CHECK_NAME, notMeasuredOutput, type BudgetsOutput } from './output.ts';
import type { OutboxRowsReader } from './raises.ts';

/** What a run returns when it posted nothing. */
const SILENT = Object.freeze({ posted: false, reason: 'budgets are off here, or the loop is not installed' });

/** What a run of the check needs to find the pull request and its head commit. */
export type BudgetsRequest = { installationId: number; owner: string; repo: string; prNumber: PrNumber; headSha: string };

/**
 * The check's three stages, the body its job of the ledger runs in order in one try (./job.ts): `target`
 * reads the pull request (null when it gets no check at all), `measure` gives the verdict, `publish` posts it
 * and answers the check run's id.
 */
export function budgetsStages(
  { octokitFor, readOutboxRows, log }: { octokitFor: OctokitFor<GitHubClient>; readOutboxRows: OutboxRowsReader | null; log: (line: string) => void },
  { installationId, owner, repo, prNumber, headSha }: BudgetsRequest,
) {
  return {
    target: async () => budgetedPull(await octokitFor(installationId), { owner, repo, prNumber }),
    measure: async (pr: PullFacts) => measurePull(await octokitFor(installationId), { owner, repo, pr: { ...pr, headSha } }, { readOutboxRows, log }),
    publish: async (output: BudgetsOutput) => postBudgets(await octokitFor(installationId), { owner, repo, headSha, output }),
  };
}

/** The pull request, when its base branch has the loop with budgets on; null for any other. */
async function budgetedPull(octokit: GitHubClient, { owner, repo, prNumber }: Repo & { prNumber: PrNumber }): Promise<PullFacts | null> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha });
  return config && contextBudget(config).enabled ? pr : null;
}

/** Posts the check run, completed, on the head SHA. @returns its id */
async function postBudgets(octokit: GitHubClient, { owner, repo, headSha, output }: Repo & { headSha: string; output: BudgetsOutput }): Promise<number> {
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name: BUDGETS_CHECK_NAME,
    head_sha: headSha,
    external_id: BUDGETS_EXTERNAL_ID,
    status: 'completed',
    conclusion: output.conclusion,
    completed_at: new Date().toISOString(),
    output: { title: output.title, summary: output.summary },
  });
  return CreatedSchema.parse(data).id;
}

/** Posts the check `neutral`, saying why, on a pull request whose base has budgets on; nothing on any other, nor when GitHub cannot say. */
export async function postNotMeasured(
  octokit: GitHubClient,
  { owner, repo, prNumber, headSha }: Repo & { prNumber: PrNumber; headSha: string },
  reason: unknown,
) {
  let pr: PullFacts | null = null;
  try {
    pr = await budgetedPull(octokit, { owner, repo, prNumber });
  } catch {
    // GitHub itself may be what failed: whether budgets are on stays unknown, so nothing is posted.
  }
  if (!pr) return { ...SILENT };
  const output = notMeasuredOutput(`the check could not run — ${firstLine(reason)}`);
  return { checkRunId: await postBudgets(octokit, { owner, repo, headSha, output }), name: BUDGETS_CHECK_NAME, conclusion: output.conclusion };
}
