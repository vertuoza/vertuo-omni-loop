// `fix-row-stamp` as a job of the ledger (PRD omni-loop-3 s3; PRD 2011 s7, acceptance 5): what the `fixRowStamp`
// function did, moved over. `/api/github` adds one job for a pull request closed, merged or not, or
// reopened (../webhook/webhook.ts), keyed `<owner/name>#<pr>@<what>@<when>`, lower case, in no lane, with 4 tries;
// its payload is the stamp's facts (where, which pull request, what happened to it and when, the record its body
// names), never a token (L-GDPR-2). A run stamps the Fixes rows of every bug record born on the server whose
// repository and pull request it is, through `fix_row_stamp()` as the service role (./stamp.ts):
//
//   merged     the row shows `merged`; the last merge of a record's rows ships the record
//   closed     unmerged: the row shows `closed, not merged`, and the record stays open
//   reopened   the row is open again
//
// A merge matching no row, whose body names a record (`Fixes mobile-B74`) of a product holding the repository,
// stamps nothing and is kept on that record as `unmatched merge <repo>#<n>`.
//
// It is handed no GitHub: the payload carries every fact it needs, so it reads nothing there and never merges
// anything (N-PRODUCT-15). A database that refuses throws, and the worker retries the job (../jobs/worker.ts); a
// second run keeps the first merge and ships nothing twice. No stamper (the App cannot reach the server here): the
// job ends `skipped`.
import type { NewJob } from '../jobs/ledger.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import { noteTo } from '../run-log/run-log.ts';
import { FixStampDataSchema, type FixStampData } from './fix-stamp.ts';
import type { FixStamper } from './stamp.ts';

export const FIX_ROW_STAMP_KIND = 'fix-row-stamp';

/** A stamp's tries: the 4th that throws fails it. */
const MAX_TRIES = 4;

/** The job of one stamp: keyed by pull request, change and time, so a delivery GitHub sends twice is one job. */
export function fixRowStampJob({ installationId, repository, prNumber, kind, at, bug }: FixStampData): NewJob {
  const subject = repository.toLowerCase();
  return {
    kind: FIX_ROW_STAMP_KIND,
    key: `${subject}#${String(prNumber)}@${kind}@${at}`,
    subject,
    payload: { installationId, repository, prNumber, kind, at, bug },
    maxTries: MAX_TRIES,
  };
}

/** The handler of the `fix-row-stamp` kind, bound to the stamper (`null`: the server is out of reach here) and a log. */
export function fixRowStampHandler({ stamp, log = noteTo('fix-row-stamp') }: { stamp: FixStamper | null; log?: (line: string) => void }): JobHandler {
  return async (job): Promise<JobResult> => {
    const { repository, prNumber, kind, at, bug } = FixStampDataSchema.parse(job.payload);
    const pull = `${repository}#${String(prNumber)}`;
    if (!stamp) {
      log(`fix stamp: ${pull} ${kind} stamps nothing: the App cannot reach the server here`);
      return { outcome: 'skipped', reason: 'the App cannot reach the server here' };
    }
    const answer = await stamp({ repository, prNumber, kind, at, bug });
    for (const shipped of answer.shipped) log(`fix stamp: ${pull} merged, the last fix of ${shipped}: it ships`);
    if (answer.unmatched !== null) log(`fix stamp: ${pull} merged, matching no row of ${answer.unmatched}: kept as unmatched merge ${pull.toLowerCase()}`);
    return { outcome: 'done' };
  };
}
