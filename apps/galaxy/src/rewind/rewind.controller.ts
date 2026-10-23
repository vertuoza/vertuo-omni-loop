import { authenticate, type TokenCheck } from '../ask/auth';
import { reply } from '../business-api/reply';
import { bodyOf, receivePush, refuse } from '../data/kit-push';
import { DecideBodySchema, FactsQuerySchema, FindingIdSchema, MAX_DECIDE_BYTES, MAX_PUSH_BYTES, PushBodySchema, REWIND_REFUSALS, type RewindRefusal, type Verdict } from './rewind.contract';
import type { DecisionService, RewindService } from './rewind.service';

// The rewind's two calls, at their HTTP edge (PRD 2410, s5; ADR-0095), as plain functions of a Request, so
// they are tested with a fake service and the routes under app/api/rewind/ stay one line each:
//
//   GET  /api/rewind/facts?repo&prd   → 200 {watches, breaks, findings}
//   POST /api/rewind/findings         → 200 {added}
//   POST /api/rewind/findings/<id>/approve, …/reject → 200 {state, followUp}   (s7: the page's session only)
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
  const client = deps.connect(auth.caller.token);
  return answered(deps.log, 'rewind facts', COULD_NOT, () => client.service.facts(query.data.repo, query.data.prd));
}

/** A service's answer, or why it refused, in words. */
type Answer = { ok: true; value: unknown } | { ok: false; kind: RewindRefusal; error: string };

/** The service's answer at the HTTP edge: 200 its value, its refusal's status, or 500 without the failure's
 * words, logged under `what`. */
async function answered(log: (line: string) => void, what: string, words: string, work: () => Promise<Answer | Response>): Promise<Response> {
  try {
    const done = await work();
    if (done instanceof Response) return done;
    return done.ok ? reply(200, done.value) : refuse(REWIND_REFUSALS[done.kind], done.error);
  } catch (error) {
    log(`${what}: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(REWIND_REFUSALS.database, words);
  }
}

/** What a decision needs: the page's session, the decision as its member. */
export type DecisionDeps = {
  /** The decision as the page's signed-in person, or null when nobody is signed in; itself null when no database is configured. */
  session: (() => Promise<DecisionService | null>) | null;
  log: (line: string) => void;
};

const BY_TOKEN = 'A finding is approved or rejected on the PRD\'s page, by a signed-in member: a token never decides one.';
const BAD_REASON = 'A reason is one line of at most 500 characters.';
const NOT_DECIDED = 'The decision could not be saved. Try again.';

/** The request's body as a decision: the reason it gives (null for none), or false when it is too large, no
 * JSON, or out of shape. An empty body gives none. */
async function reasonOf(request: Request): Promise<string | null | false> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_DECIDE_BYTES) return false;
  if (text.trim() === '') return null;
  let sent: unknown;
  try {
    sent = JSON.parse(text);
  } catch {
    return false;
  }
  const read = DecideBodySchema.safeParse(sent);
  if (!read.success) return false;
  return read.data.reason === undefined || read.data.reason === '' ? null : read.data.reason;
}

/** A member approves or rejects the proposed finding `id`, once, with the page's session only (PRD 2410, s7);
 * Approve then sends its work, and the answer says what it sent. A reason goes with a Reject only. */
async function decide(request: Request, id: string, verdict: Verdict, deps: DecisionDeps): Promise<Response> {
  if (request.headers.get('authorization') !== null) return refuse(REWIND_REFUSALS['not-allowed'], BY_TOKEN);
  if (!deps.session) return refuse(REWIND_REFUSALS.unavailable, NO_DATABASE);
  if (!FindingIdSchema.safeParse(id).success) return refuse(REWIND_REFUSALS.missing, 'No such finding on a PRD of your workspace.');
  const reason = await reasonOf(request);
  if (reason === false || (verdict === 'approve' && reason !== null)) return refuse(REWIND_REFUSALS.malformed, verdict === 'approve' ? 'An approval takes no reason.' : BAD_REASON);
  const session = deps.session;
  return answered(deps.log, 'rewind decide', NOT_DECIDED, async () => {
    const service = await session();
    if (!service) return refuse(REWIND_REFUSALS['signed-out'], 'Sign in to decide a finding.');
    return service.decide(id, verdict, reason);
  });
}

/** POST /api/rewind/findings/<id>/approve: a member approves a proposed finding, and Approve sends its work. */
export const approveFinding = (request: Request, id: string, deps: DecisionDeps): Promise<Response> => decide(request, id, 'approve', deps);

/** POST /api/rewind/findings/<id>/reject {reason?}: a member rejects a proposed finding, with its optional reason. */
export const rejectFinding = (request: Request, id: string, deps: DecisionDeps): Promise<Response> => decide(request, id, 'reject', deps);

/** POST /api/rewind/findings: proposes the rewind's findings for a PRD, as the caller's workspace. */
export async function postRewindFindings(request: Request, deps: RewindDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, { unavailable: NO_DATABASE, maxBytes: MAX_PUSH_BYTES });
  if (received instanceof Response) return received;
  const push = bodyOf(PushBodySchema, received.sent, 'A rewind push');
  if ('problem' in push) return refuse(REWIND_REFUSALS.malformed, push.problem);
  return answered(deps.log, 'rewind push', COULD_NOT, () => received.client().service.propose(push.repo, push.prd, push.findings));
}
