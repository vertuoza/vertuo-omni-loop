// The escalation sweep as a job of the ledger (PRD omni-loop-3 s2; PRD 1794): what the `escalation`
// function did, moved over. The schedule (../jobs/schedule.ts) adds one `escalation` job every hour, keyed
// `escalation@<slot start>`, in the lane `escalation` (one sweep at a time: two never race to post the same ask),
// with 3 tries. A run lists the App's installations as the App itself, then sweeps each repository they hold
// (./sweep.ts).
//
// Each repository swept is a saved step (bug #2756): a try its function cut short, or a refusal ended, carries on
// from the next repository, and a second run asks nobody twice (an ask already posted on a pull request is never
// posted again). A slot the sweep missed is not added later: the next one moves every step that
// fell due since. A call the shared GitHub client refuses unsent ends the run `waiting` (../jobs/worker.ts).
// Asking never decides: it reads and writes comments only. The payload holds the slot only, never a token
// (L-GDPR-2).
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import type { GitHubClient } from '../outbox-check/github.ts';
import { noteTo } from '../run-log/run-log.ts';
import { sweepAll, type AppClient, type Swept } from './sweep.ts';

export const ESCALATION_KIND = 'escalation';

/** The line a run that swept logs: what it swept, asked, and left for the next hour. */
function sweptLine({ repositories, pulls, asked, failed }: Swept): string {
  return `escalation: ${String(repositories)} repositories, ${String(pulls)} open pull requests, ${String(asked)} asked, ${String(failed)} left for the next hour`;
}

/** The handler of the `escalation` kind, bound to each installation's GitHub, the App's own (`null`: off), a log and a clock. */
export function escalationHandler({
  octokitFor,
  appOctokit,
  log = noteTo('escalation'),
  clock = Date.now,
}: {
  octokitFor: OctokitFor<GitHubClient>;
  appOctokit: AppClient | null;
  log?: (line: string) => void;
  clock?: () => number;
}): JobHandler {
  return async (_job, run): Promise<JobResult> => {
    if (appOctokit === null) {
      log('escalation: the App cannot list its installations here, so nobody is asked.');
      return { outcome: 'skipped', reason: 'no app: the App cannot list its installations here' };
    }
    const swept = await sweepAll({ app: await appOctokit(), octokitFor, now: new Date(clock()), log, ...(run ? { step: run.step } : {}) });
    log(sweptLine(swept));
    return { outcome: 'done' };
  };
}
