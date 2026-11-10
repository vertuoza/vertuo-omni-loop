// The budgets check as a job of the ledger (PRD 2688 s5, spec "The handlers" and "Failure, never stuck"): the
// body of the `budgets-check` Inngest function moved over, kind `pr-budgets`. One job per pull request, keyed
// `<owner/name>#<number>`, lower case; the payload holds the installation, the repository, the pull request and
// its head commit, never a token (L-GDPR-2).
//
//   handler        the function's steps in order, in one try: read the pull request (a base without the loop's
//                  config, with a config that does not parse, or with budgets off ends the job `skipped` and posts
//                  nothing), measure, publish the check run completed. A second run posts a newer check run on
//                  the same head commit, as an Inngest retry does. GitHub's budget low is thrown as the budget's
//                  own refusal, which the worker reads as `waiting`
//   failure hook   once the 5th try threw, post the check `neutral`, saying why: a check that cannot run never
//                  blocks a merge (D6), and is never left as nothing
//
// The verdicts are the function's: this moves where the check runs, not what it decides.
import { z } from 'zod';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { GitHubClient } from '../outbox-check/github.ts';
import { REFRESH_DELAY_SECONDS, type RefreshJob } from '../jobs/ledger.ts';
import type { FailureHook, JobHandler, JobResult } from '../jobs/worker.ts';
import { budgetsStages, postNotMeasured, type BudgetsRequest } from './budgets-check.ts';
import type { OutboxRowsReader } from './raises.ts';

export const BUDGETS_KIND = 'pr-budgets';

const PayloadSchema = z.object({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  prNumber: PrNumberSchema,
  headSha: z.string().min(1),
});

/** The job a pull request's budgets check makes, to refresh on each event: keyed by repository and pull request, lower case. */
export function budgetsJob(request: BudgetsRequest): RefreshJob {
  const subject = `${request.owner}/${request.repo}`.toLowerCase();
  return { kind: BUDGETS_KIND, key: `${subject}#${String(request.prNumber)}`, subject, payload: { ...request }, delaySeconds: REFRESH_DELAY_SECONDS };
}

/** The job's payload, or the error naming its first malformed field. */
function requestOf(raw: unknown): BudgetsRequest {
  const parsed = PayloadSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new Error(`The budgets job is malformed: ${issue?.path.join('.') || '(payload)'}: ${issue?.message ?? parsed.error.message}`);
}

/** The handler of the `pr-budgets` kind: `octokitFor` an installation's GitHub, `readOutboxRows` a product PRD's raises (null when unreadable). */
export function budgetsHandler({
  octokitFor,
  readOutboxRows = null,
  log = noteTo('budgets-check'),
}: {
  octokitFor: OctokitFor<GitHubClient>;
  readOutboxRows?: OutboxRowsReader | null;
  log?: (line: string) => void;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    const stages = budgetsStages({ octokitFor, readOutboxRows, log }, requestOf(job.payload));
    const pr = await stages.target();
    if (!pr) return { outcome: 'skipped', reason: 'budgets are off here, or the loop is not installed' };
    await stages.publish(await stages.measure(pr));
    return { outcome: 'done' };
  };
}

/** The failure hook of the `pr-budgets` kind: the check `neutral`, saying why, where budgets are on. */
export function budgetsFailureHook({ octokitFor }: { octokitFor: OctokitFor<GitHubClient> }): FailureHook {
  return async (job, reason) => {
    const request = requestOf(job.payload);
    await postNotMeasured(await octokitFor(request.installationId), request, reason);
  };
}
