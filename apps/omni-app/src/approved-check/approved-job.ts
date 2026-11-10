// `omni/approved` as a job of the ledger (PRD 2688 s4, spec "The handlers" and "Failure, never stuck"): the body
// of the `approved-check` function (./approved-check.ts `checkApproved`) run in one try, its steps in order, and
// the kind's failure hook. One job per pull request, keyed `<owner/name>#<number>`, its payload the check's event
// data: the installation, the repository, the pull request and its head commit. No token (L-GDPR-2).
//
//   handler  done when it posted the check run; skipped, with why, when the pull request gets no check (no loop
//            config, the check off, no PRD approved on the server). GitHub's budget low is thrown for the worker
//            to read as `waiting`. A job may run twice: a second run posts a newer check run on the same head
//   failure  once the 5th try threw: the check run completed as `failure` with the reason, so the pull request
//            never waits on a check that will not come. Nothing on a pull request the check does not run on
//            (a base without the loop's config, the check off, no PRD approved on the server)
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { APPROVED_EXTERNAL_ID, checkPayloadOf, CheckRequestDataSchema, type CheckRequestData } from '../inngest-client.ts';
import type { FailureHook, JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { completeAsFailure, type GitHubClient } from '../outbox-check/github.ts';
import { noteTo } from '../run-log/run-log.ts';
import { NO_JUDGE, checkApproved, checkNameOf, refusalIn, targetOf, type ApprovedDeps } from './approved-check.ts';
import type { RecordReader } from './record.ts';
import type { AskJudge } from './repo-reading.ts';

export const APPROVED_KIND = 'pr-approved';

type Needs = {
  octokitFor: OctokitFor<GitHubClient>;
  /** The record's reader; null when the App cannot read the server here, which holds every product PRD's check. */
  readRecord: RecordReader | null;
  galaxyUrl: string;
  ask?: AskJudge;
  now?: () => Date;
  log?: (line: string) => void;
};

/** The handler of the `pr-approved` kind. */
export function approvedHandler({ octokitFor, readRecord, galaxyUrl, ask = NO_JUDGE, now = () => new Date(), log = noteTo('approved-check') }: Needs): JobHandler {
  const deps: ApprovedDeps = { octokitFor, readRecord, galaxyUrl, ask, now, log };
  return async (job): Promise<JobResult> => {
    const run = await checkApproved(deps, requestOf(job.payload), { target: (work) => work(), product: (work) => work(), repo: (work) => work(), publish: (work) => work(), budgeted: (work) => work() });
    return 'posted' in run ? { outcome: 'skipped', reason: run.reason } : { outcome: 'done' };
  };
}

/** The failure hook of the `pr-approved` kind. */
export function approvedFailure({ octokitFor }: Pick<Needs, 'octokitFor'>): FailureHook {
  return async (job, reason) => {
    const { installationId, owner, repo, prNumber, headSha } = requestOf(job.payload);
    const octokit = await octokitFor(installationId);
    const name = await checkNameOf(octokit, { owner, repo, prNumber });
    if (name === null) return;
    if (!(await mayBeChecked(octokit, { owner, repo, prNumber }))) return;
    await completeAsFailure(octokit, { owner, repo, headSha, name, reason, externalId: APPROVED_EXTERNAL_ID });
  };
}

/**
 * False only when the check is known not to run on this pull request. When GitHub cannot say (the read that
 * failed the job may be the one failing again), it is true: a check that could not decide says so (BL-GATE-1).
 * The budget's refusal is thrown, never swallowed.
 */
async function mayBeChecked(octokit: GitHubClient, at: { owner: string; repo: string; prNumber: PrNumber }): Promise<boolean> {
  try {
    return (await targetOf(octokit, at)) !== null;
  } catch (error) {
    if (refusalIn(error)) throw error;
    return true;
  }
}

/** The job's payload as the check's request, or the error naming its first malformed field. */
const requestOf = (raw: unknown): CheckRequestData => checkPayloadOf(CheckRequestDataSchema, APPROVED_KIND, raw);
