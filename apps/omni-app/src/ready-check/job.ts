// The ready check as a job of the ledger (PRD 2898 s7), kind `pr-ready`: one job per pull request, keyed
// `<owner/name>#<number>`, lower case (../jobs/pr-checks.ts), refreshed by every pull request event, by a CI
// run that completed on its head (../webhook/webhook.ts), and by GitHub's Re-run of the check itself. The
// payload holds the installation, the repository, the pull request and its head commit, never a token (L-GDPR-2).
//
//   handler        ./ready-check.ts in one try: a pull request the gate does not run on ends `skipped` and
//                  posts nothing; else the check is posted (or left as it is when it says the same) and the
//                  verdict saved. GitHub's budget low is thrown as the budget's own refusal, read as `waiting`
//   failure hook   once the 5th try threw, the check `neutral`, not judged, saying why, on a gated pull request
import { checkPayloadOf, PullAtSchema } from '../jobs/payloads.ts';
import type { FailureHook, JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import type { GitHubClient } from '../outbox-check/github.ts';
import { firstLine } from '../outbox-check/github-schema.ts';
import { noteTo } from '../run-log/run-log.ts';
import { postNotJudged, runReadyCheck, type ReadyRequest } from './ready-check.ts';
import type { ReadyStore } from './store.ts';

export const READY_KIND = 'pr-ready';

/** The job's payload, or the error naming its first malformed field. */
const requestOf = (raw: unknown): ReadyRequest => checkPayloadOf(PullAtSchema, READY_KIND, raw);

/** The handler of the `pr-ready` kind: `octokitFor` an installation's GitHub, `store` the database (null when unreachable). */
export function readyHandler({
  octokitFor,
  store = null,
  log = noteTo('ready-check'),
}: {
  octokitFor: OctokitFor<GitHubClient>;
  store?: ReadyStore | null;
  log?: (line: string) => void;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    const request = requestOf(job.payload);
    const run = await runReadyCheck(await octokitFor(request.installationId), { store, request });
    if (!('verdict' in run)) return { outcome: 'skipped', reason: run.reason };
    if (!run.saved && run.reason !== null) log(`the ready verdict of ${job.key} was not saved: ${run.reason}`);
    return { outcome: 'done' };
  };
}

/** The failure hook of the `pr-ready` kind: the check `neutral`, not judged, saying why, where the gate runs. */
export function readyFailureHook({ octokitFor, store = null }: { octokitFor: OctokitFor<GitHubClient>; store?: ReadyStore | null }): FailureHook {
  return async (job, reason) => {
    const request = requestOf(job.payload);
    await postNotJudged(await octokitFor(request.installationId), { store, request, reason: `the check could not run — ${firstLine(reason)}` });
  };
}
