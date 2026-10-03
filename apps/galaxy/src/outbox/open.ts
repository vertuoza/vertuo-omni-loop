// Whether this deployment may send from the Outbox tab (PRD 251, s11): it knows the omni-loop App's
// client (GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET, both server-only) and has its database.
// Reads only the groups it is given, so the tab asks it without the server's clients.
import { serverEnv, type ArcadeEnv } from '../env';

export function sendOpen(env: Pick<ArcadeEnv, 'githubOAuth' | 'supabase'> = serverEnv()): boolean {
  return env.githubOAuth !== null && env.supabase !== null;
}
