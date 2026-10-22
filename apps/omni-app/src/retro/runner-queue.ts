// The retro's runner queue (PRD 2338): it queues `/omni:retro-apply --retro <retro PR>` for the
// repository, as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the approved check's
// own pair). No person asked for the job, so it is sent by the app (`runner_jobs.sent_by_app`, with no
// `sent_by`), never in a person's name (Never 10, supabase/migrations/20261223090000_runner_jobs_sent_by_app.sql).
//
//   workspace   the one the App's installation belongs to (`workspaces.github_installation_id`, unique):
//               the repository's workspace, so the job goes nowhere else (BR-PRODUCT-63); none, and
//               nothing is queued
//   found       a job of that workspace, for that repository, with that line, whatever its sender or
//               status: a replay of the retro, or its day-14 run on the same retro PR, finds it again
//               and queues no second one
//   insert      else the job, queued for any runner of the workspace that holds the repository
//
// The retro runs one at a time per repository (`CONCURRENCY` in ./retro.ts), so the lookup and the
// insert never race with another retro of the same repository. Throws when the database refuses or
// answers out of shape: the step retries, then the run's failure comment says why.
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** Who the job is sent by: the app, never a person (`runner_jobs.sent_by_app`). */
const APP_SENDER = 'omni-app';

/** A job to queue: the installation the retro ran as, the repository (owner/name), the line. */
export type ApplyJob = { installationId: number; repository: string; line: string };

/** What queueing did: the job, `created` when this call made it, or why there is none. */
export type Queued = { job: string | null; created: boolean; reason: string | null };

/** Queues one job for the line, or finds the one already queued. */
export type ApplyQueue = (job: ApplyJob) => Promise<Queued>;

/** A row read for its id: a workspace, or a job. */
export const IdRowSchema = z.object({ id: z.string().min(1) });

/** The queue, as the service role on `connection`. */
export function runnerQueue(connection: Connection): ApplyQueue {
  const db = serviceDb(connection);
  return async ({ installationId, repository, line }) => {
    const repo = repository.toLowerCase();
    const [workspace] = rowsOf(IdRowSchema, await db.from('workspaces').select('id').eq('github_installation_id', installationId).limit(1));
    if (!workspace) return { job: null, created: false, reason: `no workspace holds the installation ${String(installationId)}` };

    const [found] = rowsOf(
      IdRowSchema,
      await db.from('runner_jobs').select('id').eq('workspace_id', workspace.id).eq('repo', repo).eq('line', line).order('queued_at').limit(1),
    );
    if (found) return { job: found.id, created: false, reason: null };

    const [made] = rowsOf(IdRowSchema, await db.from('runner_jobs').insert({ workspace_id: workspace.id, repo, line, sent_by_app: APP_SENDER }).select('id'));
    if (!made) throw new Error('the database queued no job and gave no reason');
    return { job: made.id, created: true, reason: null };
  };
}
