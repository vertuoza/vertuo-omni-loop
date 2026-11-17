// The `bug-report` job (PRD 2980 s4): a scrubbed Omni Loop bug report, filed on the Omni Loop repository by the job ledger.
// `submitBugReport` is what the mission's supervisor (PRD 2980 s5) calls on a repair's `omni-loop` record: it scrubs the retro's
// fields, and a report `scrub()` refuses files nothing and says why; one it clears is added as a job. The ledger's tries
// (1, 5, 30 minutes, 2 hours) are the retry when GitHub refuses; a job that threw is run whole again, and what it
// already filed is never filed twice (./file.ts).
//
// The payload holds the public report only, which `scrub()` already cleared: never the retro's raw message, a token or a person's
// words (L-GDPR-2). One job at a time runs in the lane, so two reports of one fingerprint never race to file two issues.
import { PublicReportSchema, scrub, type PublicReport, type ScrubInput } from 'omni-loop/kit/lib/repair/scrub.ts';
import { z } from 'zod';
import type { NewJob } from '../jobs/ledger.ts';
import { checkPayloadOf } from '../jobs/payloads.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import { noteTo } from '../run-log/run-log.ts';
import { fileBugReport, OMNI_LOOP_REPOSITORY, type BugIssues, type BugReportStore, type Filed } from './file.ts';

export const BUG_REPORT_KIND = 'bug-report';
/** One report is filed at a time. */
export const BUG_REPORT_LANE = 'bug-report';

/** A bug report job's payload: the public report. */
const BugReportJobDataSchema = z.object({ report: PublicReportSchema });

/** What submitting a report did: queued for filing, or refused, with why (said on the workspace's own pages only). */
export type Submitted = { ok: true } | { ok: false; reason: string };

/**
 * Submits a report: scrubs `input`, and adds a job to file it. `attempt` tells one meeting of a fingerprint from another (the
 * repair's id), so a repeat is a job of its own and the same meeting twice is added once.
 */
export async function submitBugReport({ input, attempt, add }: { input: ScrubInput; attempt: string; add: (job: NewJob) => Promise<boolean> }): Promise<Submitted> {
  const scrubbed = scrub(input);
  if (!scrubbed.ok) return { ok: false, reason: scrubbed.reason };
  const { report } = scrubbed;
  await add({
    kind: BUG_REPORT_KIND,
    key: `bug-report:${report.fingerprint}:${attempt}`,
    subject: OMNI_LOOP_REPOSITORY,
    payload: { report },
    lane: BUG_REPORT_LANE,
  });
  return { ok: true };
}

const line = ({ kind, repo, issue, fingerprint }: Filed): string => `bug report ${fingerprint.slice(0, 8)}: ${kind === 'filed' ? 'filed' : '+1 on'} ${repo}#${String(issue)}`;

/** The handler of the `bug-report` kind, bound to the issues, the store and the repository setting. */
export function bugReportHandler({
  issues,
  store,
  repo = OMNI_LOOP_REPOSITORY,
  log = noteTo('bug-report'),
  onFiled,
}: {
  issues: BugIssues;
  store: BugReportStore;
  repo?: string;
  log?: (line: string) => void;
  /** What the supervisor does with the issue (PRD 2980 s5): it stops the PRD on it. */
  onFiled?: (filed: Filed, report: PublicReport) => Promise<void>;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    const { report } = checkPayloadOf(BugReportJobDataSchema, BUG_REPORT_KIND, job.payload);
    const filed = await fileBugReport({ report, repo, store, issues });
    log(line(filed));
    await onFiled?.(filed, report);
    return { outcome: 'done' };
  };
}
