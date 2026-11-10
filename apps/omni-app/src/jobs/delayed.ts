// A stuck check shows as delayed (PRD 2688 s6, spec "Failure, never stuck"): the sweep, every 15 minutes, posts a check
// whose job is due but has not started for over 10 minutes as `queued`, its summary `Delayed: Omni is retrying this
// check`, on the job's head commit and under that kind's check name. A job due less long is left alone, and a job of
// any other kind (the knowledge pack's) is never posted for: only the four pull-request checks are on a pull request.
//
// It only reads the ledger (the service role's select) and writes one check run per delayed job, which the check's own
// next run supersedes with a newer one on the same commit. It never touches a comment, an answer or the job. The payload
// is read for the installation, the repository and the head commit only; it holds no token (L-GDPR-2), and an error is
// logged to its first line. The first refusal for a low GitHub budget stops the pass: the next sweep tries again.
import { GithubDeferred, GithubPaused } from '@omni/github';
import { z } from 'zod';
import { ConfigSchema } from 'omni-loop/kit/lib/config.ts';
import type { Connection } from '../approved-check/record.ts';
import type { RequestOctokit } from '../knowledge-harvest/github.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** How long a check may be due before the pull request shows it as delayed. */
export const DELAYED_AFTER_MINUTES = 10;

/** The summary of the `queued` check run. */
export const DELAYED_SUMMARY = 'Delayed: Omni is retrying this check';

const DEFAULTS = ConfigSchema.parse({ kit: 1 }).ci;

/** The kit's default check names, by the four kinds of job that run a check. A repository's own `ci.*Context` is read by the handler, not here. */
const DELAYED_CHECKS: Readonly<Record<string, string>> = {
  'pr-outbox': DEFAULTS.outboxContext,
  'pr-inbox': DEFAULTS.inboxContext,
  'pr-approved': DEFAULTS.approvedContext ?? 'omni/approved',
  'pr-budgets': 'omni / budgets',
};

/** A job the sweep may post for: its kind, its key and what it needs. */
export type DueJob = { kind: string; key: string; payload: Record<string, unknown> };

/** What the sweep reads of the database: the queued jobs of these kinds due at or before `before` (an ISO time), oldest first. */
export type DelayedStore = { due: (input: { kinds: string[]; before: string }) => Promise<DueJob[]> };

/** What a pass did: the jobs due over the delay, the check runs posted, the jobs left alone, the posts GitHub refused, and whether a low budget stopped it. */
export type DelayedSummary = { due: number; posted: number; skipped: number; failed: number; stopped: boolean };

const DueRowSchema = z.object({ kind: z.string().min(1), key: z.string().min(1), payload: z.record(z.string(), z.unknown()) });

/** The store, as the service role on `connection`. */
export function delayedStore(connection: Connection): DelayedStore {
  const db = serviceDb(connection);
  return {
    due: async ({ kinds, before }) =>
      rowsOf(
        DueRowSchema,
        await db.from('background_jobs').select('kind, key, payload').eq('state', 'queued').in('kind', kinds).lte('run_after', before).order('run_after'),
      ),
  };
}

const TargetSchema = z.object({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  headSha: z.string().regex(/^[0-9a-f]{40}$/),
});

/** Whether GitHub's budget refused the call, however Octokit wrapped it. */
const budgetRefused = (error: unknown): boolean =>
  error instanceof GithubDeferred || error instanceof GithubPaused || (error instanceof Error && budgetRefused(error.cause));

const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';

/** Posts, `queued` and delayed, the check of every pull-request job due over {@link DELAYED_AFTER_MINUTES} minutes ago. */
export async function postDelayed({
  store,
  octokitFor,
  clock = Date.now,
  log = noteTo('jobs'),
}: {
  store: DelayedStore;
  octokitFor: OctokitFor<RequestOctokit>;
  clock?: () => number;
  log?: (line: string) => void;
}): Promise<DelayedSummary> {
  const before = new Date(clock() - DELAYED_AFTER_MINUTES * 60_000).toISOString();
  const jobs = await store.due({ kinds: Object.keys(DELAYED_CHECKS), before });
  const summary: DelayedSummary = { due: jobs.length, posted: 0, skipped: 0, failed: 0, stopped: false };
  for (const { kind, key, payload } of jobs) {
    const name = DELAYED_CHECKS[kind];
    const target = TargetSchema.safeParse(payload);
    if (name === undefined || !target.success) {
      summary.skipped += 1;
      log(`a ${kind} job is delayed but holds no commit to show it on: left alone`);
      continue;
    }
    const { installationId, owner, repo, headSha } = target.data;
    try {
      const octokit = await octokitFor(installationId);
      await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
        owner,
        repo,
        name,
        head_sha: headSha,
        status: 'queued',
        output: { title: 'Delayed', summary: DELAYED_SUMMARY },
      });
      summary.posted += 1;
    } catch (error) {
      if (budgetRefused(error)) {
        summary.stopped = true;
        log("the delayed checks stopped: GitHub's budget is low, the rest waits for the next sweep");
        break;
      }
      summary.failed += 1;
      log(`the delayed check of ${key} could not be posted: ${firstLine(error)}`);
    }
  }
  return summary;
}
