// The business read of the kit's contract (PRD 748's spec, "The read"), as a plain function of a
// Request, so it is tested with a stubbed Supabase client and app/api/business/route.ts stays one line:
//
//   GET /api/business?repo=<owner/name>   → 200 {state, business, product, claims}   (decision 14)
//
// The kit calls it with the terminal's sign-in. Only confirmed claims come back (decision 15): the
// database's business_for_repo() picks them, and the answer is checked against the contract's schema
// before it leaves. `state` is `none` when the workspace has no business or no confirmed claim for the
// repository; the kit's own states (`no-sign-in`, `unreachable`, `refused`) are never the server's.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed query, 401 no valid bearer
// token, 403 a repository outside the caller's workspaces (the database's reason, and the App's install
// link after its install hint), 503 no database here or the sign-in service down, 500 the database failed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { businessReader, BusinessStoreError } from './read';

/** A Supabase client acting as one access token: the Auth server's check and the functions. */
export type BusinessClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type BusinessDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => BusinessClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string) => reply(status, { error });

function refusal(error: BusinessStoreError, deps: BusinessDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === '22023') return refuse(400, error.reason);
  console.error(`business: ${error.message}`);
  return refuse(500, 'The business database could not answer. Try again.');
}

/** What agents in `?repo=` read of their workspace's business. */
export async function readBusiness(request: Request, deps: BusinessDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'The business is not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  if (repo.length > 200 || !REPO.test(repo)) return refuse(400, '`repo` must be the repository as owner/name.');
  try {
    return reply(200, await businessReader(deps.connect(auth.caller.token)).forRepo(repo));
  } catch (error) {
    if (!(error instanceof BusinessStoreError)) throw error;
    return refusal(error, deps);
  }
}
