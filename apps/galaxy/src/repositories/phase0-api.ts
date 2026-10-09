// Where a repository's phase 0 is approved, read for the kit (PRD 1299 s1), as a plain function of a
// Request, so it is tested with a stubbed Supabase client and the route stays one line:
//
//   GET /api/repositories/phase0?repo=<owner/name>   → 200 {phase0: 'pr' | 'server'}
//
// The kit (`/omni:brainstorm`) calls it with the terminal's sign-in. The database's repository_phase0()
// (supabase/migrations/20261120090000_phase0_flag.sql), run as the caller, answers the flag of the
// repository in the caller's workspace, `pr` for one the workspace does not list. Refusals follow
// ADR-0029, each `{error}` in plain words: 400 a malformed repository, 401 no valid bearer token, 403 a
// repository outside the caller's workspaces (the database's reason, and the App's install link after
// its install hint), 503 no database here, 500 the database failed or answered out of shape.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { Phase0Schema } from './model';

/** A Supabase client acting as one access token: the Auth server's check and the functions. */
export type Phase0Client = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type Phase0Deps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => Phase0Client) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;
const BAD_REPO = '`repo` must be the repository as owner/name.';
const NOT_READ = 'Phase 0 could not be read. Try again.';

const isRepo = (repo: string) => repo.length <= 200 && REPO.test(repo);

/** The database's refusal of a call, as the route answers it. */
function refusalOf(error: { code?: string; message?: string }, installLink: string | null | undefined): Response {
  const { code, message } = error;
  if (code === '42501') return refuse(403, withInstallLink(message || 'Not a member of the workspace that owns this repository.', installLink));
  if (code === '22023') return refuse(400, message || BAD_REPO);
  console.error(`phase0: ${message || code || 'the database failed'}`);
  return refuse(500, NOT_READ);
}

export async function readPhase0(request: Request, deps: Phase0Deps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Phase 0 is not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  if (!isRepo(repo)) return refuse(400, BAD_REPO);
  const answer = await deps.connect(auth.caller.token).rpc('repository_phase0', { p_repo: repo });
  if (answer.error) return refusalOf(answer.error, deps.installLink);
  const phase0 = Phase0Schema.safeParse(answer.data);
  if (!phase0.success) {
    console.error(`phase0: the database answered out of shape for ${repo}: ${JSON.stringify(answer.data)}`);
    return refuse(500, NOT_READ);
  }
  return reply(200, { phase0: phase0.data });
}
