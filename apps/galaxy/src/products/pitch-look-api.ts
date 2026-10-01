// The pitch look's read for the kit (PRD 859 s1), as a plain function of a Request, so it is tested
// with a stubbed Supabase client and app/api/pitch-look/route.ts stays one line:
//
//   GET /api/pitch-look?repo=<owner/name>   → 200 {look}   arcade | keynote
//
// The kit (`/omni:pitch`) calls it with the terminal's sign-in. The database's pitch_look_for_repo()
// (supabase/migrations/20261029090000_products_pitch_look.sql), run as the caller, answers the look of
// the repository's product, and `arcade` for a repository with no product. Refusals follow ADR-0029,
// each `{error}` in plain words: 400 a malformed repository, 401 no valid bearer token, 403 a
// repository outside the caller's workspaces (the database's reason, and the App's install link after
// its install hint), 503 no database here, 500 the database failed or answered a look it does not know.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { isPitchLook } from './model';

/** A Supabase client acting as one access token: the Auth server's check and the functions. */
export type PitchLookClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type PitchLookDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => PitchLookClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;

const isRepo = (repo: string) => repo.length <= 200 && REPO.test(repo);

export async function readPitchLook(request: Request, deps: PitchLookDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'The pitch look is not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  if (!isRepo(repo)) return refuse(400, '`repo` must be the repository as owner/name.');
  const { data, error } = await deps.connect(auth.caller.token).rpc('pitch_look_for_repo', { p_repo: repo });
  if (error) {
    const { code, message } = error as { code?: string; message?: string };
    if (code === '42501') return refuse(403, withInstallLink(message ?? 'Not a member of the workspace that owns this repository.', deps.installLink));
    if (code === '22023') return refuse(400, message ?? '`repo` must be the repository as owner/name.');
    console.error(`pitch-look: ${message ?? code ?? 'the database failed'}`);
    return refuse(500, 'The pitch look could not be read. Try again.');
  }
  if (!isPitchLook(data)) {
    console.error(`pitch-look: an unexpected answer ${JSON.stringify(data)}`);
    return refuse(500, 'The pitch look could not be read. Try again.');
  }
  return reply(200, { look: data });
}
