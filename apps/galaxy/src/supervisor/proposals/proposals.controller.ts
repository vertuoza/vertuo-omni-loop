import type { z } from 'zod';
import { refuse, reply } from '../../business-api/reply';
import type { AppError } from '../../server-event/app-errors';
import { SUPERVISOR_REFUSALS } from '../api/supervisor.contract';
import { DismissReplySchema, DismissRequestSchema, PressReplySchema, PressRequestSchema } from './proposals.contract';
import type { ProposalActs, ProposalsService, Served } from './proposals.service';

// An owner's press and dismissal (PRD omni-loop-34 s7; ADR-0095), as plain functions of a Request, each route file one line:
//
//   POST /api/supervisor/proposals          {workspace, proposal}           an owner   presses a suggestion: 200 {press}
//   POST /api/supervisor/proposals/dismiss  {workspace, finding, reason?}   an owner   Not a problem: 200 {dismissed}
//
// The page's session only: a request with an authorization header (the seat's, a key's) is refused, since the seat
// proposes and owners press. Signed out is 401 and nothing else runs; a member is 403 and nothing is written. A refusal
// is `{error}` in plain words; a failure is 500, logged and written to app_errors (masked).

export type ProposalsDeps = {
  /** The browser's signed-in person, by id, or null; null itself when no database is configured. */
  session: (() => Promise<string | null>) | null;
  /** The rules, as the service role, with the routes of today as the signed-in owner; null with no service role. */
  service: ProposalsService | null;
  /** An owner's press and dismissal, as the signed-in person. */
  acts: () => Promise<ProposalActs>;
  log: (line: string) => void;
  failed: (error: AppError) => Promise<void>;
};

const MAX_BODY_CHARS = 8 * 1024;
const NO_DATABASE = 'The Supervisor is not available here: this deployment has no database.';
const NO_SERVICE = 'The Supervisor is not available here: this deployment has no service role.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The suggestion could not be carried out. Try again.';
const PEOPLE_ONLY = 'Only a workspace owner presses a suggestion, signed in on the Supervisor page.';
const BAD_PRESS = 'The body must be {"workspace": "<id>", "proposal": "<the suggestion\'s id>"}.';
const BAD_DISMISS = 'The body must be {"workspace": "<id>", "finding": "<id>", "reason"?: "<500 characters or fewer>"}.';

/** The request's JSON body read by `schema`, or null: too long, not JSON, or out of shape. */
async function bodyAs<T>(request: Request, schema: z.ZodType<T>): Promise<T | null> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const shaped = schema.safeParse(value);
  return shaped.success ? shaped.data : null;
}

/** A failure of a route: logged, written to app_errors (masked), answered 500 in plain words. */
async function failure(route: string, deps: ProposalsDeps, error: unknown): Promise<Response> {
  const message = error instanceof Error ? error.message : String(error);
  deps.log(`supervisor: ${route}: ${message}`);
  await deps.failed({ workspace: null, route, status: SUPERVISOR_REFUSALS.database, message });
  return refuse(SUPERVISOR_REFUSALS.database, FAILED);
}

/** Why a request is not served before anything runs: a bearer header, no database, no service role. */
function closed(request: Request, deps: ProposalsDeps): Response | null {
  if (request.headers.get('authorization') !== null) return refuse(SUPERVISOR_REFUSALS.forbidden, PEOPLE_ONLY);
  if (!deps.session) return refuse(SUPERVISOR_REFUSALS.unavailable, NO_DATABASE);
  return deps.service === null ? refuse(SUPERVISOR_REFUSALS.unavailable, NO_SERVICE) : null;
}

/** Runs `serve` for the signed-in person and answers its value in `shape`; a refusal in its words, a failure 500, recorded. */
async function answer<T>(
  route: string, request: Request, deps: ProposalsDeps, shape: z.ZodType,
  serve: (service: ProposalsService, caller: string) => Promise<Served<T> | Response>, wrap: (value: T) => unknown,
): Promise<Response> {
  const refused = closed(request, deps);
  if (refused !== null || deps.service === null || deps.session === null) return refused ?? refuse(SUPERVISOR_REFUSALS.unavailable, NO_SERVICE);
  const { service, session } = deps;
  return session()
    .then(async (caller) => {
      if (caller === null) return refuse(SUPERVISOR_REFUSALS['signed-out'], SIGNED_OUT);
      const served = await serve(service, caller);
      if (served instanceof Response) return served;
      return served.ok ? reply(200, shape.parse(wrap(served.value))) : refuse(SUPERVISOR_REFUSALS[served.kind], served.error);
    })
    .catch((error: unknown) => failure(route, deps, error));
}

/** POST /api/supervisor/proposals: an owner presses a suggestion. */
export function supervisorPress(request: Request, deps: ProposalsDeps): Promise<Response> {
  return answer('POST /api/supervisor/proposals', request, deps, PressReplySchema, async (service, caller) => {
    const body = await bodyAs(request, PressRequestSchema);
    return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_PRESS) : service.press(caller, body.workspace, body.proposal, await deps.acts());
  }, (press) => ({ press }));
}

/** POST /api/supervisor/proposals/dismiss: an owner says Not a problem. */
export function supervisorDismiss(request: Request, deps: ProposalsDeps): Promise<Response> {
  return answer('POST /api/supervisor/proposals/dismiss', request, deps, DismissReplySchema, async (service, caller) => {
    const body = await bodyAs(request, DismissRequestSchema);
    return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_DISMISS) : service.dismiss(caller, body.workspace, body.finding, body.reason ?? null, await deps.acts());
  }, (dismissed) => ({ dismissed }));
}
