import { authenticate, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { PACK_REFUSALS, PackQuerySchema, PackReplySchema } from './knowledge-packs.contract';
import type { KnowledgePacksService } from './knowledge-packs.service';

// A repository's knowledge pack, at its HTTP edge for the kit (PRD 2011; ADR-0095), as a plain function of
// a Request, so it is tested with a fake service and the route stays one line:
//
//   GET /api/knowledge-packs?repo=<owner/name>[&sha=<commit>]
//     → 200 {repository, sha, committedAt, madeAt, files: [{path, sha256, content}]}
//
// The kit's `omni kb pack get` (PRD 2011 s12) calls it with the terminal's sign-in (a bearer token). The
// sign-in is checked first: signed out, 401, and nothing is read. The service then reads as the caller's
// access token, never a service key, so a member reads only their own workspaces' packs (law
// BR-PRODUCT-63). Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed query, 401 no
// valid sign-in, 404 no pack, 503 no database here or the sign-in service down, 500 the database failed,
// logged.

/** A client acting as one access token: the Auth server's check and the packs as that person. */
type CallerClient = TokenCheck & { service: KnowledgePacksService };

export type KnowledgePacksDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  log: (line: string) => void;
};

const NO_DATABASE = 'Knowledge packs are not available here: this deployment has no database.';
const BAD_QUERY = 'Name the repository as `repo=owner/name`, and the commit, when given, as `sha=<the full 40-character commit>`.';

/** GET /api/knowledge-packs: the newest pack of the repository the query names, or the pack of its commit. */
export async function readKnowledgePack(request: Request, deps: KnowledgePacksDeps): Promise<Response> {
  if (!deps.connect) return refuse(PACK_REFUSALS.unavailable, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const query = PackQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return refuse(400, BAD_QUERY);
  try {
    const served = await deps.connect(auth.caller.token).service.read(query.data);
    if (!served.ok) {
      if (served.kind === 'database') deps.log(`knowledge-packs: ${query.data.repo}: ${served.error}`);
      return refuse(PACK_REFUSALS[served.kind], served.error);
    }
    return reply(200, PackReplySchema.parse(served.value));
  } catch (error) {
    deps.log(`knowledge-packs: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(PACK_REFUSALS.database, 'The knowledge pack could not be read. Try again.');
  }
}
