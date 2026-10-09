import { z } from 'zod';
import { AskingSchema } from 'vertuo-omni-plan/kit/lib/approval/stream.ts';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { authenticate, callerOrigin, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { askApprovers, waitingApprovals, type AskDeps } from './approvals.service';

// The approvals' HTTP edge (PRD 1322 s2), as plain functions of a Request, so they are tested with fake
// repositories and each route stays one line:
//
//   POST /api/dossiers/approval/request {repo, prd}  → 200 {asked: [{login, name}], nobodyElse, author, product}
//   GET  /api/waiting/approvals                       → 200 {items: [{id, dossierId, prd, title, repo, askedAt}]}
//
// The request is the kit's (`omni wait approval`), with the terminal's sign-in (a bearer token); its
// reply is the shape settled item s4-01-approval-stream-contract records, checked against the kit's own
// schema before it leaves. The bell's read is the page's, with the person's own session. Refusals follow
// ADR-0029, each `{error}` in plain words: 400 a malformed body (or the database's own: a ◇ PRD), 401 no
// valid sign-in, 403 not a member, 404 no such PRD the caller reads, 503 no database here, 500 the
// database failed or answered out of shape.

/** A client acting as one access token: the Auth server's check and the caller's approvals. */
type CallerClient = TokenCheck & { approvals: AskDeps['approvals'] };

export type RequestDeps = Omit<AskDeps, 'approvals'> & {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
};

export type WaitingDeps = {
  /** The signed-in person's approvals (their own session), or null when nobody is signed in; null
   * itself when no database is configured. */
  session: (() => Promise<AskDeps['approvals'] | null>) | null;
};

const NO_DATABASE = 'Approvals are not available here: this deployment has no database.';
const NOT_ASKED = 'The approvers could not be asked. Try again.';
const NOT_READ = 'The approval requests could not be read. Try again.';
const MAX_BODY_BYTES = 4 * 1024;

const Body = z.object({ repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/), prd: PrdNumberSchema });

/** The body of a request, or the Response that refuses it. */
async function bodyOf(request: Request): Promise<z.infer<typeof Body> | Response> {
  const text = await request.text();
  const malformed = () => refuse(400, 'The body must be a JSON object: {"repo": "owner/name", "prd": <number>}.');
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return malformed();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return malformed();
  }
  const parsed = Body.safeParse(value);
  return parsed.success ? parsed.data : malformed();
}

/** The database's refusal as the route answers it; anything else is a 500, never a guess. */
export function refusalOf(refusal: { code: string | null; message: string | null }, failed: string, log: (line: string) => void): Response {
  const { code, message } = refusal;
  if (code === '42501') return refuse(403, message || 'Not a member of the workspace that owns this PRD.');
  if (code === 'P0002') return refuse(404, message || 'No such PRD.');
  if (code === '22023') return refuse(400, message || failed);
  log(`approvals: ${message || code || 'the database failed'}`);
  return refuse(500, failed);
}

/** A client acting as the caller's sign-in, or the Response that refuses them: 503 with no database
 * here or the sign-in service down, 401 no valid sign-in. Shared with the stream (PRD 1322 s3). */
export async function callerOf<C extends TokenCheck>(request: Request, connect: ((token: string) => C) | null): Promise<C | Response> {
  if (!connect) return refuse(503, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), connect);
  return auth.ok ? connect(auth.caller.token) : refuse(auth.status, auth.error);
}

/** POST: asks a ◆ PRD's approvers, reaches each one, and answers who was asked. */
export async function requestApproval(request: Request, deps: RequestDeps): Promise<Response> {
  const { connect, ...ask } = deps;
  const client = await callerOf(request, connect);
  if (client instanceof Response) return client;
  const body = await bodyOf(request);
  if (body instanceof Response) return body;
  const asked = await askApprovers({ ...ask, approvals: client.approvals }, body.repo.toLowerCase(), body.prd, callerOrigin(request));
  if (!asked.ok) return refusalOf(asked.refusal, NOT_ASKED, deps.log);
  const shaped = AskingSchema.safeParse(asked.reply);
  if (!shaped.success) {
    deps.log(`approvals: the reply for ${body.repo} #${body.prd} is out of the kit's shape`);
    return refuse(500, NOT_ASKED);
  }
  return reply(200, shaped.data);
}

/** GET: the approval requests waiting on the signed-in person, for the bell. */
export async function approvalsWaiting(deps: WaitingDeps): Promise<Response> {
  if (!deps.session) return refuse(503, NO_DATABASE);
  const approvals = await deps.session();
  if (!approvals) return refuse(401, 'Sign in first to see what waits for you.');
  const read = await waitingApprovals(approvals);
  if (!read.ok) return refusalOf(read.refusal, NOT_READ, (line) => { console.error(line); });
  return reply(200, { items: read.value });
}
