import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseAs, supabaseEnv } from '../../data/supabase-server';
import { installUrl } from '../../signup/github-app';
import { jevDecideDeps } from '../resolve-live';
import { placedFrom, type DecideRouteDeps } from './decide-route';

// The decide route's real dependencies (./decide-route.ts, PRD 812 s3): the caller's token is checked
// by the Auth server; the service role asks repo_workspace() where the caller's calls for the
// repository go, which no signed-in role may call, and runs the resolver (../resolve-live.ts). Without
// Supabase configured every call answers 503; without the service role every decision answers as Off.
export function decideDeps(env: Record<string, string | undefined> = process.env): DecideRouteDeps {
  const configured = supabaseEnv() !== null;
  return {
    connect: configured ? supabaseAs : null,
    place: placeRepo,
    jev: configured ? jevDecideDeps(env) : null,
    installLink: installUrl(env.GITHUB_APP_SLUG),
  };
}

/** repo_workspace() for a person and a repository, as the service role: the workspace's id, or why none. */
async function placeRepo(userId: string, repo: string): Promise<{ workspace: string | null; reason: string | null }> {
  const { data, error } = await serviceDb().rpc('repo_workspace', { person: userId, repo });
  if (error) throw new Error(`repo_workspace: ${error.message}`);
  return placedFrom(data);
}
