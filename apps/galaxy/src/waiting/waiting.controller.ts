import 'server-only';
import { viewer } from '../data/viewer';
import { WAITING_ERROR_STATUS, type WaitingErrorKind } from './waiting.contract';
import { waitingReads, type WaitingReads } from './waiting.service';

// The bell's read routes (PRD 1318, s4; ADR-0095), polled by the waiting provider through the browser's
// client (src/waiting/waiting.client.ts) in the shapes of src/waiting/waiting.contract.ts:
//
//   GET /api/waiting/questions   the Questions part, every 5 s visible and 15 s hidden
//   GET /api/waiting/documents   the New documents part, every 10 s visible
//   GET /api/waiting/reviews     the Reviews part (PRD 2377 s5): the open review, merge and law waits whose turn
//                                names the person by login, for the workspace they joined first
//   GET /api/waiting/runners     the Runners badge (PRD 2255), every 15 s visible: how many of the workspace's
//                                runner jobs wait for an answer, for the workspace the person joined first,
//                                as the Runners page reads it
//
// The session is checked first, from the request's cookie claims, read locally as viewer() reads them
// (no call to the database): signed out, 401 `signed-out`, and no service runs, so a tab whose sign-in
// expired stops asking the database (bug #1316). A deployment with no database, or the demo, has nobody
// signed in, so it answers the same. Signed in, the service reads as that person, on the viewer's own
// client, so row-level security has the last word; a failed read is 500 `database`, logged. Only the
// cookie session is read, never a bearer token: a kit or runner token is signed out here (BR-PRODUCT-94
// keeps an agent from acting as a person; this route only counts, for a person).

/** The signed-in person, the reads as them, and the workspace they joined first (read once, when asked). */
type WaitingViewer = { userId: string; reads: WaitingReads; workspace: () => Promise<{ id: string } | null> };

/** Who is asking: the signed-in person and the reads as them, or null when signed out. */
export type WaitingReadDeps = { signedIn(): Promise<WaitingViewer | null>; now(): number };

const NO_STORE = { 'cache-control': 'no-store' };

const refuse = (error: WaitingErrorKind): Response => Response.json({ error }, { status: WAITING_ERROR_STATUS[error], headers: NO_STORE });

/** One read, as a person: signed out first, then the read, a failure as `database`. */
async function answer(deps: WaitingReadDeps, read: (who: WaitingViewer) => Promise<unknown>): Promise<Response> {
  const who = await deps.signedIn();
  if (!who) return refuse('signed-out');
  try {
    return Response.json(await read(who), { headers: NO_STORE });
  } catch (error) {
    console.error(error);
    return refuse('database');
  }
}

/** The read handlers, on `deps`. */
export function waitingReadHandlers(deps: WaitingReadDeps) {
  return {
    questions: (): Promise<Response> =>
      answer(deps, async ({ userId, reads }) => ({ questions: await reads.questionsReader(userId)(deps.now()) })),
    documents: (): Promise<Response> =>
      answer(deps, async ({ userId, reads }) => ({ documents: await reads.documents(userId, deps.now()) })),
    reviews: (): Promise<Response> =>
      answer(deps, async ({ userId, reads, workspace }) => {
        const joined = await workspace();
        return { items: joined ? await reads.reviews(userId, joined.id) : [] };
      }),
    runners: (): Promise<Response> =>
      answer(deps, async ({ reads, workspace }) => {
        const joined = await workspace();
        return { count: joined ? await reads.runnersWaiting(joined.id) : 0 };
      }),
  };
}

const live = waitingReadHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? { userId: seen.user.id, reads: waitingReads(seen.db), workspace: () => seen.workspace() } : null;
  },
  now: Date.now,
});

/** GET /api/waiting/questions */
export const getQuestions = (): Promise<Response> => live.questions();
/** GET /api/waiting/documents */
export const getDocuments = (): Promise<Response> => live.documents();
/** GET /api/waiting/reviews */
export const getReviews = (): Promise<Response> => live.reviews();
/** GET /api/waiting/runners */
export const getRunners = (): Promise<Response> => live.runners();
