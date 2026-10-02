// The constituents read of the kit's contract (PRD 871), as a plain function of a Request, so it is
// tested with a stubbed Supabase client and app/api/constituents/route.ts stays one line:
//
//   GET /api/constituents?repo=<owner/name>   → 200 {state, product, statement, never, latestEventId}
//
// `omni constituents` calls it at every session's start with the terminal's sign-in. The database's
// constituents_for_repo(), run as the caller, picks the repository's product in the caller's workspace
// and answers its live Statement and Never lines; the answer is checked against the schema before it
// leaves. `state` is `none` when the repository has no product or the product no constituent.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed query, 401 no valid bearer
// token, 403 a repository outside the caller's workspaces (the database's reason, and the App's install
// link after its install hint), 503 no database here or the sign-in service down, 500 the database
// failed or answered something unexpected.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { constituentsReadSchema, type ConstituentsRead } from './model';

/** A Supabase client acting as one access token: the Auth server's check and the functions. */
export type ConstituentsClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type ConstituentsDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => ConstituentsClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;
const isRepo = (repo: string) => repo.length <= 200 && REPO.test(repo);

/** The database refused or failed; `code` is Postgres's (42501 not the caller's repository, 22023 a
 * malformed one), or undefined for an answer the schema refused. */
class ConstituentsStoreError extends Error {
  readonly code: string | undefined;
  readonly reason: string;
  constructor(code: string | undefined, reason: string) {
    super(`read the constituents: ${reason}`);
    this.code = code;
    this.reason = reason;
  }
}

/** A read of the database function `fn` for `repo`, checked against the contract's schema. */
async function readFor(db: Pick<SupabaseClient, 'rpc'>, fn: string, repo: string): Promise<ConstituentsRead> {
  const { data, error } = await db.rpc(fn, { p_repo: repo });
  if (error) throw new ConstituentsStoreError(error.code, error.message);
  const read = constituentsReadSchema.safeParse(data);
  if (!read.success) throw new ConstituentsStoreError(undefined, `an unexpected answer: ${read.error.issues[0]?.message ?? 'malformed'}`);
  return read.data;
}

export function constituentsReader(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** What a terminal in `repo` (owner/name) reads, as the caller. */
    forRepo: (repo: string) => readFor(db, 'constituents_for_repo', repo),
    /** What the omni-loop App reads for `repo`, with the service role. */
    forRepoApp: (repo: string) => readFor(db, 'constituents_for_repo_app', repo),
  };
}

function refusal(error: ConstituentsStoreError, deps: ConstituentsDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === '22023') return refuse(400, error.reason);
  console.error(`constituents: ${error.message}`);
  return refuse(500, 'The constituents could not be read. Try again.');
}

/** What agents in `?repo=` read of their product's constituents. */
export async function readConstituents(request: Request, deps: ConstituentsDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'The constituents are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  if (!isRepo(repo)) return refuse(400, '`repo` must be the repository as owner/name.');
  try {
    return reply(200, await constituentsReader(deps.connect(auth.caller.token)).forRepo(repo));
  } catch (error) {
    if (!(error instanceof ConstituentsStoreError)) throw error;
    return refusal(error, deps);
  }
}
