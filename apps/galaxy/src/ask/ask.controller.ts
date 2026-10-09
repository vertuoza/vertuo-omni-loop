import 'server-only';
import { viewer } from '../data/viewer';
import { ASK_ERROR_STATUS, type AskError, type AskErrorKind } from './ask.contract';
import { isSessionId } from './page/sign-in';
import { askReads, type AskReads } from './ask.service';

// The ask pages' read routes (PRD 1318, s2; ADR-0095), polled every 2 s by the browser's client
// (src/ask/ask.client.ts) in the shapes of src/ask/ask.contract.ts:
//
//   GET /api/ask/tabs, GET /api/ask/sessions/:id, GET /api/ask/rounds/:id
//
// The session is checked first, from the request's cookie claims, read locally as viewer() reads them
// (no call to the database): signed out, 401 `signed-out`, and no service runs. A deployment with no
// database, or the demo, has nobody signed in, so it answers the same. Signed in, the service reads as
// that person, on the viewer's own client, so row-level security has the last word: a session or
// round of another workspace is 404 `not-found`, exactly like a missing one; an id that is no uuid is
// 422 `invalid`; a failed read is 500 `database`, logged once.

/** Who is asking: the signed-in person and the reads as them, or null when signed out. */
export type AskReadDeps = { signedIn(): Promise<{ userId: string; reads: AskReads } | null>; now(): number };

/** The id a route was called with. */
type IdParams = { params: Promise<{ id: string }> };

const refuse = (error: AskErrorKind, field?: string): Response => {
  const body: AskError = field === undefined ? { error } : { error, field };
  return Response.json(body, { status: ASK_ERROR_STATUS[error], headers: { 'cache-control': 'no-store' } });
};

const ok = (body: unknown): Response => Response.json(body, { headers: { 'cache-control': 'no-store' } });

/** What a read answers for an id that is no uuid: no session or round anyone has. */
const INVALID_ID = Symbol('invalid id');

/** One read, as a person: signed out first, then the read, null as not found, a failure as `database`. */
async function answer(deps: AskReadDeps, read: (who: { userId: string; reads: AskReads }) => Promise<unknown>): Promise<Response> {
  const who = await deps.signedIn();
  if (!who) return refuse('signed-out');
  try {
    const found = await read(who);
    if (found === INVALID_ID) return refuse('invalid', 'id');
    return found === null ? refuse('not-found') : ok(found);
  } catch (error) {
    console.error(error);
    return refuse('database');
  }
}

/** The three read handlers, on `deps`. */
export function askReadHandlers(deps: AskReadDeps) {
  return {
    tabs: (): Promise<Response> => answer(deps, async ({ userId, reads }) => ({ tabs: await reads.tabs(userId, deps.now()) })),

    async session(_request: Request, { params }: IdParams): Promise<Response> {
      const { id } = await params;
      return answer(deps, ({ reads }) => (isSessionId(id) ? reads.session(id) : Promise.resolve(INVALID_ID)));
    },

    async round(_request: Request, { params }: IdParams): Promise<Response> {
      const { id } = await params;
      return answer(deps, ({ reads }) => (isSessionId(id) ? reads.question(id) : Promise.resolve(INVALID_ID)));
    },
  };
}

const live = askReadHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? { userId: seen.user.id, reads: askReads(seen.db) } : null;
  },
  now: Date.now,
});

/** GET /api/ask/tabs */
export const getTabs = (): Promise<Response> => live.tabs();
/** GET /api/ask/sessions/:id */
export const getSession = (request: Request, context: IdParams): Promise<Response> => live.session(request, context);
/** GET /api/ask/rounds/:id */
export const getRound = (request: Request, context: IdParams): Promise<Response> => live.round(request, context);
