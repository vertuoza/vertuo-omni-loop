// The `runner-jobs-expire` job (PRD omni-loop-35 s3, spec "A. Jobs expire after 48 hours"): a schedule of the ledger
// (../schedule.ts), every 15 minutes, 3 tries. A run calls `runner_jobs_expire(p_now)` once (./store.ts), at the
// clock's time, and logs what it did:
//
//   failed      queued jobs no runner took in 48 h since they could first run, ended failed
//   expired     jobs ended Held, Waiting on answers or Need human that nobody continued in 48 h, now `expired`
//   questions   their rounds nobody answered, closed
//   grouped     the Supervisor's per-job findings closed, now that its checks group by cause
//
// The App applies the rule, never the Supervisor; the 48 hours live in the function alone. A stalled sweep has no done
// job for three periods, so `background_jobs_health()` reads it late (it is one of SCHEDULES), and the Supervisor's
// late-schedule check raises it. The payload holds the slot only, never a token; no job id is logged.
import { noteTo } from '../../run-log/run-log.ts';
import type { JobHandler, JobResult } from '../worker.ts';
import type { ExpireStore } from './store.ts';

export const RUNNER_JOBS_EXPIRE_KIND = 'runner-jobs-expire';

/** The handler of the `runner-jobs-expire` kind: `store` is the database's sweep. */
export function runnerJobsExpireHandler({
  store,
  clock = Date.now,
  log = noteTo(RUNNER_JOBS_EXPIRE_KIND),
}: {
  store: ExpireStore;
  clock?: () => number;
  log?: (line: string) => void;
}): JobHandler {
  return async (): Promise<JobResult> => {
    const { failed, expired, questions, grouped } = await store.expire(new Date(clock()));
    log(`runner jobs expire: ${String(failed)} queued ended failed, ${String(expired)} waiting expired, ${String(questions)} rounds closed, ${String(grouped)} per-job findings grouped`);
    return { outcome: 'done' };
  };
}
