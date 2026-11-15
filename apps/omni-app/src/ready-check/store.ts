// The ready check's store (PRD 2898 s7), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the
// App's own pair): the App has no person's session. Both reads and the one write go through the workspace the
// App's installation belongs to (`workspaces.github_installation_id`), so nothing is read from or saved in
// another workspace (BR-PRODUCT-63).
//
//   inMission   under `ready.checks: mission`, whether the PRD belongs to a mission of its repository that is
//               running, waiting on a person or paused: in its scope's PRDs, or a row of one of its roadmaps
//   save        the verdict of one pull request at one head commit into `public.ready_verdicts`, a re-run on
//               the same commit rewriting its row
//
// Throws when the database refuses or answers out of shape: the job retries.
import { z } from 'zod';
import { PrdNumberSchema, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Json } from '../../../../supabase/database.types.ts';
import type { Connection } from '../approved-check/record.ts';
import { IdRowSchema } from '../retro/runner-queue.ts';
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

export type ReadyStore = {
  inMission(input: PrdOfInstallation): Promise<boolean>;
  save(verdict: SavedVerdict): Promise<{ saved: boolean; reason: string | null }>;
};

/** A live mission's scope, as the table holds it. */
export const MissionScopeRowSchema = z.object({ scope: z.object({ prds: z.array(PrdNumberSchema), roadmaps: z.array(z.number().int().positive()) }) });

/** A roadmap's row holding the PRD. */
export const RoadmapRowOfSchema = z.object({ roadmap_id: z.string().min(1) });

/** The store, as the service role on `connection`. */
export function readyStore(connection: Connection): ReadyStore {
  const db = serviceDb(connection);
  const workspaceOf = async (installationId: number) =>
    rowsOf(IdRowSchema, await db.from('workspaces').select('id').eq('github_installation_id', installationId).limit(1))[0]?.id ?? null;

  return {
    async inMission({ installationId, repository, prd }) {
      const workspace = await workspaceOf(installationId);
      if (workspace === null) return false;
      const repo = repository.toLowerCase();
      const missions = rowsOf(
        MissionScopeRowSchema,
        await db.from('missions').select('scope').eq('workspace_id', workspace).eq('repo', repo).in('status', [...LIVE_MISSIONS]),
      );
      if (missions.some(({ scope }) => scope.prds.includes(prd))) return true;
      const numbers = [...new Set(missions.flatMap(({ scope }) => scope.roadmaps))];
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
  };
}
