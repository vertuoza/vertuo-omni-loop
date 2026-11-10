// The worker (PRD 2676 s1, spec "The worker"): `runDue` claims the jobs due, one at a time, for a time budget
// of 240 seconds, runs each through the handler of its kind and records how its try ended:
//
//   the job                                        the outcome
//   finished                                       done
//   nothing to do                                  skipped, with why
//   threw, tries left                              retry, waiting 1, then 5, then 30 minutes, then 2 hours
//   threw on its 5th try                           failed, with the error
//   GitHub's budget for the installation is low    waiting, 15 minutes later, its try given back
//
// An error is kept as its first line, cut to 500 characters, as today's knowledge pack logs it (L-GDPR-2): never a
// stack, never a token a later line might hold. A kind with no handler here (a deploy landed between two tries)
// is an error like any other. A job may run twice and must be harmless if it does: a claim that runs out while
// the job runs is claimed again by the next worker, whose finish is the one kept (`stale` for this one).
//
// A claim the database refuses is thrown to the caller; a finish it refuses is logged and the run goes on: the
// claim runs out and the job is due again.
//
// A kind may have a failure hook (PRD 2688 s1, spec "Failure, never stuck"): it runs once, when the 5th try
// threw and the ledger kept the job `failed`, never on a finish refused, overtaken (`stale`) or queued again by a
// refresh that came while it ran. A hook that throws is logged, and the run goes on.
import { GithubDeferred, GithubPaused } from '@omni/github';
import { noteTo } from '../run-log/run-log.ts';
import type { ClaimedJob, FinishAnswer, JobLedger, JobOutcome } from './ledger.ts';

/** How long a run claims jobs for. */
export const TIME_BUDGET_MS = 240_000;
/** How long a claim holds a job: past it, the try is lost and the job due again. */
export const LEASE_SECONDS = 300;
/** A job's tries: the 5th that throws is failed. */
const MAX_TRIES = 5;
/** The wait after the 1st, 2nd, 3rd and 4th try that threw. */
const RETRY_MINUTES = Object.freeze([1, 5, 30, 120]);
/** The wait when GitHub's budget is low. */
const WAIT_MINUTES = 15;

const MINUTE = 60_000;
const MAX_REASON = 500;

/** How a handler says the job ended: done, or nothing to do and why. Anything else it throws. */
export type JobResult = { outcome: 'done' } | { outcome: 'skipped'; reason: string };
export type JobHandler = (job: ClaimedJob) => Promise<JobResult>;
/** What a kind does once its job ended failed: the job, and the error's first line as the ledger kept it. */
export type FailureHook = (job: ClaimedJob, reason: string) => Promise<void>;

/** What one run did: the jobs it ran, by how they ended; `stale` counts the finishes a newer claim overtook. */
export type RunSummary = { ran: number; stale: number } & Record<JobOutcome, number>;

type Settled = { outcome: JobOutcome; reason: string | null; retryAt: string | null };

/**
 * Runs the jobs due until none is or the time budget is spent; what it did. `handlers` maps a kind to the
 * handler that runs its jobs, `failures` a kind to the hook run once its job ended failed.
 */
export async function runDue({
  ledger,
  handlers,
  failures = {},
  clock = Date.now,
  budgetMs = TIME_BUDGET_MS,
  leaseSeconds = LEASE_SECONDS,
  log = noteTo('jobs'),
}: {
  ledger: JobLedger;
  handlers: Readonly<Partial<Record<string, JobHandler>>>;
  failures?: Readonly<Partial<Record<string, FailureHook>>>;
  clock?: () => number;
  budgetMs?: number;
  leaseSeconds?: number;
  log?: (line: string) => void;
}): Promise<RunSummary> {
  const summary: RunSummary = { ran: 0, done: 0, skipped: 0, retry: 0, waiting: 0, failed: 0, stale: 0 };
  const start = clock();
  while (clock() - start < budgetMs) {
    const [job] = await ledger.claim({ limit: 1, leaseSeconds });
    if (!job) break;
    const settled = await settle(job, handlers[job.kind], clock);
    summary.ran += 1;
    const kept = await keep(ledger, job, settled, log);
    if (kept === 'stale') summary.stale += 1;
    else if (kept !== null) summary[settled.outcome] += 1;
    if (kept === 'failed') await failed(job, settled.reason, failures[job.kind], log);
  }
  return summary;
}

/** Runs the kind's failure hook, if it has one; a hook that throws is logged. */
async function failed(job: ClaimedJob, reason: string | null, hook: FailureHook | undefined, log: (line: string) => void): Promise<void> {
  if (!hook) return;
  try {
    await hook(job, reason ?? 'it failed on its last try');
  } catch (error) {
    log(`job ${job.kind} ${job.key}: its failure hook threw: ${firstLine(error instanceof Error ? error.message : String(error))}`);
  }
}

/** Runs the job and reads how its try ended. */
async function settle(job: ClaimedJob, handler: JobHandler | undefined, clock: () => number): Promise<Settled> {
  try {
    if (!handler) throw new Error(`no handler runs jobs of kind ${job.kind} here`);
    const result = await handler(job);
    return result.outcome === 'done' ? { outcome: 'done', reason: null, retryAt: null } : { outcome: 'skipped', reason: firstLine(result.reason), retryAt: null };
  } catch (error) {
    const reason = firstLine(error instanceof Error ? error.message : String(error));
    const budget = budgetRefusal(error);
    if (budget) return { outcome: 'waiting', reason: firstLine(budget.message), retryAt: later(clock, WAIT_MINUTES) };
    const wait = RETRY_MINUTES[job.tries - 1];
    if (job.tries >= MAX_TRIES || wait === undefined) return { outcome: 'failed', reason, retryAt: null };
    return { outcome: 'retry', reason, retryAt: later(clock, wait) };
  }
}

/** Records the try; the ledger's answer, or null when it refused (logged). */
async function keep(ledger: JobLedger, job: ClaimedJob, settled: Settled, log: (line: string) => void): Promise<FinishAnswer | null> {
  const name = `job ${job.kind} ${job.key}`;
  let answer: FinishAnswer;
  try {
    answer = await ledger.finish({ id: job.id, claim: job.claim, ...settled });
  } catch (error) {
    log(`${name}: its ${settled.outcome} was not kept: ${firstLine(error instanceof Error ? error.message : String(error))}`);
    return null;
  }
  if (answer === 'stale') log(`${name}: its claim was taken over, so its ${settled.outcome} was not kept`);
  else if (settled.outcome === 'skipped') log(`${name}: skipped: ${settled.reason ?? ''}`);
  else if (settled.outcome !== 'done') log(`${name}: ${settled.outcome} on try ${String(job.tries)}: ${settled.reason ?? ''}`);
  return answer;
}

/** The budget's refusal behind `error`, however deep Octokit wrapped it; null when there is none. */
function budgetRefusal(error: unknown): GithubDeferred | GithubPaused | null {
  for (let cause = error, depth = 0; cause instanceof Error && depth < 4; cause = cause.cause, depth += 1) {
    if (cause instanceof GithubDeferred || cause instanceof GithubPaused) return cause;
  }
  return null;
}

/** A message as kept: its first line with words, trimmed, cut to 500 characters. */
function firstLine(message: string): string {
  const line = message.split('\n').map((one) => one.trim()).find((one) => one.length > 0);
  return line ? line.slice(0, MAX_REASON) : 'it threw with no message';
}

const later = (clock: () => number, minutes: number) => new Date(clock() + minutes * MINUTE).toISOString();
