// The ready check's store (PRD 2898 s7), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the
// App's own pair): the App has no person's session. Both reads and the one write go through the workspace the
// App's installation belongs to (`workspaces.github_installation_id`), so nothing is read from or saved in
// another workspace (BR-PRODUCT-63).
//
//   inMission   under `ready.checks: mission`, whether the PRD belongs to a mission of its repository that is
//               running, waiting on a person or paused: in its scope's PRDs, or a row of one of its roadmaps
//   save        the verdict of one pull request at one head commit into `public.ready_verdicts`, a re-run on
//               the same commit rewriting its row
//   appJob      the e2e fallback's runner job (PRD 2898 s8): the latest job of the repository with that line the
//               App itself sent (`runner_jobs.sent_by_app`), its status, its log tail and its reason; a person's job
//               of the same line is never read as the App's
//   queueApp    queues that line for any runner of the workspace that holds the repository, sent by the app,
//               never in a person's name (Never 10), or finds the one already queued (../retro/runner-queue.ts)
//
// Throws when the database refuses or answers out of shape: the job retries.
import { z } from 'zod';
import { PrdNumberSchema, ProductPrdIdSchema, ProductRoadmapIdSchema, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { Json } from '../../../../supabase/database.types.ts';
import type { Connection } from '../approved-check/record.ts';
import { IdRowSchema, runnerQueue, type Queued } from '../retro/runner-queue.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** The missions a gated PRD may belong to: one that has started and has not ended. */
export const LIVE_MISSIONS = Object.freeze(['running', 'waiting', 'paused'] as const);

/** A PRD of a repository, seen through the installation the App runs as. */
export type PrdOfInstallation = { installationId: number; repository: string; prd: PrdNumber };

/** One verdict to save: the pull request, its head, and what the rule decided. */
export type SavedVerdict = PrdOfInstallation & {
  prNumber: PrNumber;
  headSha: string;
  state: 'ready' | 'not ready' | 'not finished';
  passed: number;
  headline: string;
  checks: Json;
  criteria: Json;
  checkUrl: string | null;
};

/** A line of the App's own, for a repository, seen through the installation the App runs as. */
export type AppLineOfInstallation = { installationId: number; repository: string; line: string };

/** The App's own runner job of a line: where it stands, what its log ends on and why it failed, if it did. */
export type AppJob = { status: z.infer<typeof AppJobRowSchema>['status']; logTail: string; reason: string | null };

export type ReadyStore = {
  inMission(input: PrdOfInstallation): Promise<boolean>;
  save(verdict: SavedVerdict): Promise<{ saved: boolean; reason: string | null }>;
  appJob(input: AppLineOfInstallation): Promise<AppJob | null>;
  queueApp(input: AppLineOfInstallation): Promise<Queued>;
};

/** A runner job the App sent, as the fallback reads it. */
export const AppJobRowSchema = z.object({
  status: z.enum(['queued', 'claimed', 'running', 'done', 'failed', 'cancelled']),
  log_tail: z.string(),
  reason: z.string().nullable(),
});

/**
 * A live mission's scope, as the table holds it: a repository PRD's number or a product PRD's id (`omni-loop-28`), a
 * repository roadmap's number or a product roadmap's id, as the brief takes them (#3322). A product PRD is no PRD of
 * the repository, so it plays no part in the repository PRD's verdict.
 */
export const MissionScopeRowSchema = z.object({
  scope: z.object({
    prds: z.array(z.union([PrdNumberSchema, ProductPrdIdSchema])),
    roadmaps: z.array(z.union([z.number().int().positive(), ProductRoadmapIdSchema])),
  }),
});

/** A roadmap's row holding the PRD. */
export const RoadmapRowOfSchema = z.object({ roadmap_id: z.string().min(1) });

/** The live missions' scopes of `answer`, one row at a time: a row out of shape is logged and left out (#3322). */
function scopesOf(answer: Parameters<typeof rowsOf>[1], repo: string, warn: Logger['warn']) {
  return rowsOf(z.unknown(), answer).flatMap((row) => {
    const parsed = MissionScopeRowSchema.safeParse(row);
    if (parsed.success) return [parsed.data.scope];
    warn({ event: 'ready-check', repo, message: `a live mission of ${repo} has a scope out of shape, left out: ${parsed.error.message}` });
    return [];
  });
}

/** The store, as the service role on `connection`; `warn` takes a mission row it cannot read. */
export function readyStore(connection: Connection, warn: Logger['warn'] = log.warn): ReadyStore {
  const db = serviceDb(connection);
  const queue = runnerQueue(connection);
  const workspaceOf = async (installationId: number) =>
    rowsOf(IdRowSchema, await db.from('workspaces').select('id').eq('github_installation_id', installationId).limit(1))[0]?.id ?? null;

  return {
    async inMission({ installationId, repository, prd }) {
      const workspace = await workspaceOf(installationId);
      if (workspace === null) return false;
      const repo = repository.toLowerCase();
      const scopes = scopesOf(await db.from('missions').select('scope').eq('workspace_id', workspace).eq('repo', repo).in('status', [...LIVE_MISSIONS]), repo, warn);
      if (scopes.some(({ prds }) => prds.includes(prd))) return true;
      const numbers = [...new Set(scopes.flatMap(({ roadmaps }) => roadmaps.filter((roadmap) => typeof roadmap === 'number')))];
      if (numbers.length === 0) return false;
      const roadmaps = rowsOf(IdRowSchema, await db.from('roadmaps').select('id').eq('workspace_id', workspace).eq('repo', repo).in('number', numbers));
      if (roadmaps.length === 0) return false;
      const rows = rowsOf(RoadmapRowOfSchema, await db.from('roadmap_prds').select('roadmap_id').in('roadmap_id', roadmaps.map(({ id }) => id)).eq('prd', prd).limit(1));
      return rows.length > 0;
    },

    async save(verdict) {
      const workspace = await workspaceOf(verdict.installationId);
      if (workspace === null) return { saved: false, reason: `no workspace holds the installation ${String(verdict.installationId)}` };
      const row = {
        workspace_id: workspace,
        repo: verdict.repository.toLowerCase(),
        prd: verdict.prd,
        pr_number: verdict.prNumber,
        head_sha: verdict.headSha,
        state: verdict.state,
        passed: verdict.passed,
        headline: verdict.headline,
        checks: verdict.checks,
        criteria: verdict.criteria,
        check_url: verdict.checkUrl,
        decided_at: new Date().toISOString(),
      };
      rowsOf(IdRowSchema, await db.from('ready_verdicts').upsert(row, { onConflict: 'workspace_id,repo,pr_number,head_sha' }).select('id'));
      return { saved: true, reason: null };
    },

    async appJob({ installationId, repository, line }) {
      const workspace = await workspaceOf(installationId);
      if (workspace === null) return null;
      const [job] = rowsOf(
        AppJobRowSchema,
        await db
          .from('runner_jobs')
          .select('status, log_tail, reason')
          .eq('workspace_id', workspace)
          .eq('repo', repository.toLowerCase())
          .eq('line', line)
          .not('sent_by_app', 'is', null)
          .order('queued_at', { ascending: false })
          .limit(1),
      );
      return job === undefined ? null : { status: job.status, logTail: job.log_tail, reason: job.reason };
    },

    queueApp: (job) => queue(job),
  };
}
