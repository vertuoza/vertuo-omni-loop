// The business read of the kit's contract (PRD 748's spec, "The read"), as a plain function of a
// Request, so it is tested with a stubbed Supabase client and app/api/business/route.ts stays one line:
//
//   GET /api/business?repo=<owner/name>   → 200 {state, business, product, claims}   (decision 14)
//   POST /api/business/citations {repo, ids, by, ref?}   → 200 {cited}   the citation log (decision 6)
//
// The kit calls it with the terminal's sign-in. Only confirmed claims come back (decision 15): the
// database's business_for_repo() picks them, and the answer is checked against the contract's schema
// before it leaves. `state` is `none` when the workspace has no business or no confirmed claim for the
// repository; the kit's own states (`no-sign-in`, `unreachable`, `refused`) are never the server's.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed query, 401 no valid bearer
// token, 403 a repository outside the caller's workspaces (the database's reason, and the App's install
// link after its install hint), 404 a claim id the business does not hold (the citation log), 413 a
// citation too large, 503 no database here or the sign-in service down, 500 the database failed.
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
/** The largest citation call: the database takes 1 to 100 ids. */
const MAX_BODY_BYTES = 16 * 1024;

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string) => reply(status, { error });

function refusal(error: BusinessStoreError, deps: BusinessDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === '22023') return refuse(400, error.reason);
  if (error.code === 'P0002') return refuse(404, error.reason);
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

/** The citation a call sent, or the reason it is not one. The ids' own shape is the database's to judge. */
function citationOf(value: unknown): { repo: string; ids: string[]; by: string; ref: string | null } | string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'The body must be a JSON object.';
  const { repo, ids, by, ref } = value as Record<string, unknown>;
  if (typeof repo !== 'string' || repo.length > 200 || !REPO.test(repo)) return '`repo` must be the repository as owner/name.';
  const idList = Array.isArray(ids) ? ids : [];
  if (idList.length < 1 || idList.length > 100 || !idList.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 40)) {
    return '`ids` must be 1 to 100 claim ids, like rival#4.';
  }
  if (typeof by !== 'string' || !by.trim() || by.length > 80) return '`by` must name the skill that cited them.';
  if (ref !== undefined && ref !== null && typeof ref !== 'string') return '`ref`, when given, must be text.';
  return { repo, ids: idList as string[], by, ref: typeof ref === 'string' && ref.trim() ? ref : null };
}

/** Appends to the citation log the claims an agent in `repo` cited, by which skill, in which run. */
export async function citeClaims(request: Request, deps: BusinessDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'The business is not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return refuse(413, `A citation carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  let sent: unknown;
  try {
    sent = JSON.parse(text);
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
  const citation = citationOf(sent);
  if (typeof citation === 'string') return refuse(400, citation);
  try {
    const cited = await businessReader(deps.connect(auth.caller.token)).cite(citation.repo, citation.ids, citation.by, citation.ref);
    return reply(200, { cited });
  } catch (error) {
    if (!(error instanceof BusinessStoreError)) throw error;
    return refusal(error, deps);
  }
}
