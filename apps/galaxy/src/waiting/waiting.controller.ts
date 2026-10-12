import 'server-only';
import { viewer } from '../data/viewer';
import { WAITING_ERROR_STATUS, type WaitingErrorKind } from './waiting.contract';
import { waitingReads, type WaitingReads } from './waiting.service';

// The bell's read routes (PRD 1318, s4; ADR-0095), polled by the waiting provider through the browser's
// client (src/waiting/waiting.client.ts) in the shapes of src/waiting/waiting.contract.ts:
//
//   GET /api/waiting/questions   the Questions part, every 5 s visible and 15 s hidden
//   GET /api/waiting/documents   the New documents part, every 10 s visible
//
// The session is checked first, from the request's cookie claims, read locally as viewer() reads them
// (no call to the database): signed out, 401 `signed-out`, and no service runs, so a tab whose sign-in
// expired stops asking the database (bug #1316). A deployment with no database, or the demo, has nobody
// signed in, so it answers the same. Signed in, the service reads as that person, on the viewer's own
// client, so row-level security has the last word; a failed read is 500 `database`, logged.

/** Who is asking: the signed-in person and the reads as them, or null when signed out. */
export type WaitingReadDeps = { signedIn(): Promise<{ userId: string; reads: WaitingReads } | null>; now(): number };

const NO_STORE = { 'cache-control': 'no-store' };

const refuse = (error: WaitingErrorKind): Response => Response.json({ error }, { status: WAITING_ERROR_STATUS[error], headers: NO_STORE });

/** One read, as a person: signed out first, then the read, a failure as `database`. */
async function answer(deps: WaitingReadDeps, read: (who: { userId: string; reads: WaitingReads }) => Promise<unknown>): Promise<Response> {
  const who = await deps.signedIn();
  if (!who) return refuse('signed-out');
  try {
    return Response.json(await read(who), { headers: NO_STORE });
  } catch (error) {
    console.error(error);
    return refuse('database');
  }
}

/** The two read handlers, on `deps`. */
export function waitingReadHandlers(deps: WaitingReadDeps) {
  return {
    questions: (): Promise<Response> =>
      answer(deps, async ({ userId, reads }) => ({ questions: await reads.questionsReader(userId)(deps.now()) })),
    documents: (): Promise<Response> =>
      answer(deps, async ({ userId, reads }) => ({ documents: await reads.documents(userId, deps.now()) })),
  };
}

const live = waitingReadHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? { userId: seen.user.id, reads: waitingReads(seen.db) } : null;
  },
  now: Date.now,
});

/** GET /api/waiting/questions */
export const getQuestions = (): Promise<Response> => live.questions();
/** GET /api/waiting/documents */
export const getDocuments = (): Promise<Response> => live.documents();
