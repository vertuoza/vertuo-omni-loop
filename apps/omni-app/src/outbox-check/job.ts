// The `outbox` check as a job of the ledger (PRD 2688 s2): the body of the `outbox-check` Inngest function
// (./outbox-check.ts), run by the worker as the handler of the `pr-outbox` kind, its steps in order in one try.
// What the check decides does not change: it is the same body, so the verdicts are too.
//
//   handler        runs the body; a repository without the loop's config ends the job `skipped` and posts
//                  nothing. GitHub's budget low is thrown as it is: the worker reads it as `waiting`
//   failure hook   the 5th try that threw ends the job `failed`: the check is completed as `failure` with the
//                  reason (`skipped` on a pull request that is not a loop PR, nothing without the config)
//
// A job may run twice and is harmless: a second run posts a newer check run on the same head commit and updates
// the App's own status comment, as an Inngest retry does. The payload is the check request, with no token
// (L-GDPR-2).
import { NOT_ACTIVE_ON_REPO } from '../evaluate/evaluate.ts';
import { CheckRequestDataSchema } from '../inngest-client.ts';
import type { FailureHook, JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { GitHubClient } from './github.ts';
import { failOutboxCheck, runOutboxCheck, type OutboxDeps } from './outbox-check.ts';

export const OUTBOX_KIND = 'pr-outbox';

/** The job's payload as the check request, or the error naming its first malformed field. */
function requestOf(raw: unknown) {
  const parsed = CheckRequestDataSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new Error(`The pr-outbox job is malformed: ${issue?.path.join('.') || '(payload)'}: ${issue?.message ?? parsed.error.message}`);
}

/** The handler of the `pr-outbox` kind. */
export function outboxHandler(deps: OutboxDeps): JobHandler {
  return async (job): Promise<JobResult> => {
    const outcome = await runOutboxCheck(deps, requestOf(job.payload), { start: (work) => work(), evaluate: (work) => work(), publish: (work) => work(), escalation: (work) => work() });
    return 'posted' in outcome ? { outcome: 'skipped', reason: NOT_ACTIVE_ON_REPO } : { outcome: 'done' };
  };
}

/** The failure hook of the `pr-outbox` kind: today's `onFailure` of the check, moved over. */
export function outboxFailureHook({ octokitFor, log = noteTo('outbox-check') }: { octokitFor: OctokitFor<GitHubClient>; log?: (line: string) => void }): FailureHook {
  return async (job, reason) => {
    const request = requestOf(job.payload);
    await failOutboxCheck(await octokitFor(request.installationId), request, reason, log);
  };
}
