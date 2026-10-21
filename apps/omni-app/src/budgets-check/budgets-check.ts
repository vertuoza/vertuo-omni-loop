// `budgets-check`: the Inngest function posting **omni / budgets** on each pull request of a repository
// whose `budgets.context.enabled` is true (PRD 1679 s3): whether what every agent session reads stayed
// under its ceilings, the verdict `omni check context` gives in a checkout.
//
//   step "target"   read the pull request and its base branch's config: a base without the loop's config,
//                   a config that does not parse, or one with budgets off, gets nothing at all, not even
//                   `skipped` (acceptance 7)
//   step "measure"  snapshot the head and the base, measure, judge and write the output (./measure-pull.ts)
//   step "publish"  post the check run completed: `failure` on a red, `success` within budget, `neutral`
//                   when something could not be measured, which never blocks a merge (D6)
//   onFailure       once the retries are spent, post it `neutral`, saying why: a check that cannot run
//                   never blocks a merge either
//
// It listens to the outbox check's event, so every pull request action the webhook handles runs it, and
// so does the server event's re-check of a product PRD's pull requests: an `item-settled` that answers a
// raise posts it again, green, with no new push (../server-event/recheck.ts). It listens to its own event
// too, which the webhook sends for a re-run of a budgets check run (its `external_id` is
// BUDGETS_EXTERNAL_ID). Debounced per repository and pull request, 3 retries, like the other checks.
//
// The installation's GitHub budget is shared with galaxy (PRD 902): a call the budget refuses, paused or
// deferred, is never sent; the step logs one line and is retried once the pause or the window ends.
import { RetryAfterError, type Inngest } from 'inngest';
import { GithubDeferred, GithubPaused } from '@omni/github';
import { contextBudget } from 'omni-loop/kit/lib/config.ts';
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { BUDGETS_CHECK_EVENT, BUDGETS_EXTERNAL_ID, CheckRequestDataSchema, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readBaseConfig, readPull, type GitHubClient, type PullFacts, type Repo } from '../outbox-check/github.ts';
import { CreatedSchema, firstLine } from '../outbox-check/github-schema.ts';
import { onFailedRun } from '../outbox-check/outbox-check.ts';
import { measurePull } from './measure-pull.ts';
import { BUDGETS_CHECK_NAME, notMeasuredOutput, type BudgetsOutput } from './output.ts';
import type { OutboxRowsReader } from './raises.ts';

export const BUDGETS_FUNCTION_ID = 'budgets-check';

/** What a run returns when it posted nothing. */
const SILENT = Object.freeze({ posted: false, reason: 'budgets are off here, or the loop is not installed' });

const BUDGETS_DEBOUNCE = Object.freeze({
  key: 'event.data.repository + "#" + string(event.data.prNumber)',
  period: '5s',
  timeout: '1m',
});

export function createBudgetsCheck({
  client,
  octokitFor,
  readOutboxRows = null,
  log = (line) => { console.error(line); },
}: {
  client: Inngest;
  octokitFor: OctokitFor<GitHubClient>;
  /** A product PRD's outbox rows' reader; null when the App cannot read the server here, which reads no raise of a product PRD. */
  readOutboxRows?: OutboxRowsReader | null;
  log?: (line: string) => void;
}) {
  return client.createFunction(
    {
      id: BUDGETS_FUNCTION_ID,
      name: 'omni-loop · budgets',
      triggers: [{ event: OUTBOX_CHECK_EVENT }, { event: BUDGETS_CHECK_EVENT }],
      debounce: BUDGETS_DEBOUNCE,
      retries: 3,
      onFailure: createBudgetsFailureHandler({ octokitFor }),
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, prNumber, headSha } = CheckRequestDataSchema.parse(event.data);
      const budgeted = <T>(work: () => Promise<T>) => onBudget(`${owner}/${repo}#${prNumber}`, log, work);

      const pr = await step.run('target', () => budgeted(async () => budgetedPull(await octokitFor(installationId), { owner, repo, prNumber })));
      if (!pr) return { ...SILENT };

      const output = await step.run('measure', () => budgeted(async () =>
        measurePull(await octokitFor(installationId), { owner, repo, pr: { ...pr, headSha } }, { readOutboxRows, log })));

      const checkRunId = await step.run('publish', () => budgeted(async () => postBudgets(await octokitFor(installationId), { owner, repo, headSha, output })));
      return { checkRunId, name: BUDGETS_CHECK_NAME, conclusion: output.conclusion };
    },
  );
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

/**
 * The failure handler: once the run has failed after its retries, post the check `neutral`, saying why,
 * on a pull request whose base has budgets on; nothing on any other, nor when GitHub cannot say.
 */
export function createBudgetsFailureHandler({ octokitFor }: { octokitFor: OctokitFor<GitHubClient> }) {
  return onFailedRun(octokitFor, async ({ octokit, request: { owner, repo, prNumber, headSha }, reason }) => {
    let pr: PullFacts | null = null;
    try {
      pr = await budgetedPull(octokit, { owner, repo, prNumber });
    } catch {
      // GitHub itself may be what failed: whether budgets are on stays unknown, so nothing is posted.
    }
    if (!pr) return { ...SILENT };
    const output = notMeasuredOutput(`the check could not run — ${firstLine(reason)}`);
    return { checkRunId: await postBudgets(octokit, { owner, repo, headSha, output }), name: BUDGETS_CHECK_NAME, conclusion: output.conclusion };
  });
}

/** The budget's refusal `error` is, or wraps a few causes deep; null when it is none. */
function refusalOf(error: unknown, depth = 0): GithubPaused | GithubDeferred | null {
  if (error instanceof GithubPaused || error instanceof GithubDeferred) return error;
  return error instanceof Error && depth < 3 ? refusalOf(error.cause, depth + 1) : null;
}

/** Runs a step's GitHub work: a call the budget refused logs one line, and the step is retried once the budget allows it. */
async function onBudget<T>(where: string, log: (line: string) => void, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const refused = refusalOf(error);
    if (!refused) throw error;
    log(`budgets check of ${where} waits for the GitHub budget: ${refused.message}`);
    throw new RetryAfterError(refused.message, new Date(refused.until), { cause: refused });
  }
}
