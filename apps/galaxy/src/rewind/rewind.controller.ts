import { authenticate, type TokenCheck } from '../ask/auth';
import { reply } from '../business-api/reply';
import { bodyOf, receivePush, refuse } from '../data/kit-push';
import { FactsQuerySchema, MAX_PUSH_BYTES, PushBodySchema, REWIND_REFUSALS } from './rewind.contract';
import type { RewindService } from './rewind.service';

// The rewind's two calls, at their HTTP edge (PRD 2410, s5; ADR-0095), as plain functions of a Request, so
// they are tested with a fake service and the routes under app/api/rewind/ stay one line each:
//
//   GET  /api/rewind/facts?repo&prd   → 200 {watches, breaks, findings}
//   POST /api/rewind/findings         → 200 {added}
//
// The kit's `omni rewind facts` and `omni rewind push` send them with the terminal's sign-in (a bearer
// token, `omni signin`). The sign-in is checked first: signed out, 401, and nothing is read. Then the
// query or the body, by the contract's schema. Only then does the service read or propose, and it reads
// as the caller, so a PRD of another workspace reads as no watch. Refusals follow ADR-0029, each `{error}`
// in plain words (the contract lists the statuses).

/** A client acting as one access token: the Auth server's check and the service as that person. */
type CallerClient = TokenCheck & { service: RewindService };

export type RewindDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  log: (line: string) => void;
};

const NO_DATABASE = 'The rewind is not available here: this deployment has no database.';
const COULD_NOT = 'The rewind could not be read or saved. Try again.';

/** GET /api/rewind/facts: a PRD's watch on main, its breaks and its findings, as the caller. */
export async function getRewindFacts(request: Request, deps: RewindDeps): Promise<Response> {
  if (!deps.connect) return refuse(REWIND_REFUSALS.unavailable, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const query = FactsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return refuse(REWIND_REFUSALS.malformed, 'Name the repository as owner/name and the PRD as a number.');
  try {
    const done = await deps.connect(auth.caller.token).service.facts(query.data.repo, query.data.prd);
    return done.ok ? reply(200, done.value) : refuse(REWIND_REFUSALS[done.kind], done.error);
  } catch (error) {
    deps.log(`rewind facts: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(REWIND_REFUSALS.database, COULD_NOT);
  }
}

/** POST /api/rewind/findings: proposes the rewind's findings for a PRD, as the caller's workspace. */
export async function postRewindFindings(request: Request, deps: RewindDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, { unavailable: NO_DATABASE, maxBytes: MAX_PUSH_BYTES });
  if (received instanceof Response) return received;
  const push = bodyOf(PushBodySchema, received.sent, 'A rewind push');
  if ('problem' in push) return refuse(REWIND_REFUSALS.malformed, push.problem);
  try {
    const done = await received.client().service.propose(push.repo, push.prd, push.findings);
    return done.ok ? reply(200, done.value) : refuse(REWIND_REFUSALS[done.kind], done.error);
  } catch (error) {
    deps.log(`rewind push: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(REWIND_REFUSALS.database, COULD_NOT);
  }
}
