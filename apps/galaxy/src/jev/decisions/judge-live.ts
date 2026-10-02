import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import { jevDecideDeps } from '../resolve-live';
import { JUDGE_SECRET_VAR, placedWorkspace, type JudgeRouteDeps, type TrackingRow } from './judge-route';

// The constituent judge's real dependencies (./judge-route.ts, PRD 871 s4): CONSTITUENT_JUDGE_SECRET
// (server only, shared with omni-app), the service role reading which workspaces track the repository,
// and the resolver (../resolve-live.ts). Each is read per call. Without the service role the judge
// answers today's verdict.
export function judgeDeps(env: Record<string, string | undefined> = process.env): JudgeRouteDeps {
  return {
    secret: env[JUDGE_SECRET_VAR] || undefined,
    workspaceOf: trackingWorkspace,
    jev: jevDecideDeps(env),
  };
}

async function trackingWorkspace(repo: string): Promise<string | null> {
  // `data` is widened to null: the rows are read here unparsed.
  const { data, error }: { data: TrackingRow[] | null; error: { message: string } | null } = await serviceDb()
    .from('repositories')
    .select('workspace_id, added_at, workspaces(github_org, slug)')
    .eq('full_name', repo.toLowerCase())
    .eq('tracked', true);
  if (error) throw new Error(`Supabase refused to read who tracks ${repo}: ${error.message}`);
  return placedWorkspace(repo, data ?? []);
}
