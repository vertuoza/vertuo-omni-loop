import { z } from 'zod';
import { authenticate, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import {
  FleetRequestSchema, JobLinesQuerySchema, JobLinesSchema, JobReplySchema, JobUpdateReplySchema, JobUpdateSchema, NextQuerySchema, RegisterReplySchema, RegisterRequestSchema,
  RUNNER_REFUSALS, RunnerJobSchema, RunnerReplySchema, SendRequestSchema,
} from './runners.contract';
import type { RunnersService, Served } from './runners.service';

// The runners' routes (PRD 1830 s1; ADR-0095), as plain functions of a Request, so they are tested with
// the real service on a fake store and each route stays one line:
//
//   POST  /api/runners/register            the kit's sign-in   registers the runner
//   GET   /api/runners/next?runner=<id>    the kit's sign-in   holds up to 40 s: the job claimed, or 204
//   POST  /api/runners/jobs/<id>           the kit's sign-in   a report: status, log tail, live lines, PR link, exit code
//   GET   /api/runners/jobs/<id>/lines     the session         a job's live lines after `after` (PRD 1904)
//   POST  /api/runners/jobs                the session         queues a job
//   POST  /api/runners/jobs/<id>/cancel    the session         cancels a job
//   PATCH /api/runners/<id>                the session         sets or clears a runner's fleet
//
// The caller is checked first: signed out, 401, and nothing else runs. A runner's routes take a bearer
// access token (`omni signin`, or a traded OMNI_TOKEN), checked with the Auth server; the browser's
// take the page's session. The service then reads and writes as the service role, holding the rules
// itself (./runners.service.ts). Each answer is checked against the contract before it leaves; each
// refusal is `{error}` in plain words (./runners.contract.ts). A failure is 500, logged.

export type RunnersDeps = {
  /** A client acting as the given access token, for the kit's sign-in; null when no database is configured. */
  connect: ((token: string) => TokenCheck) | null;
  /** The browser's signed-in person, by id, or null; null itself when no database is configured. */
  session: (() => Promise<string | null>) | null;
  /** The rules, as the service role; null when this deployment has no service role. */
  service: RunnersService | null;
  log: (line: string) => void;
};

const MAX_BODY_CHARS = 300 * 1024;
/** A report may carry 2,000 lines of 600 characters beside its tail (PRD 1904): the runner sends at most
 * 256 KB of lines, and this bounds what the contract itself allows. */
const MAX_REPORT_CHARS = 2 * 1024 * 1024;
const NO_DATABASE = 'Runners are not available here: this deployment has no database.';
const NO_SERVICE = 'Runners are not available here: this deployment has no service role.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The runners could not answer. Try again.';
const BAD_REGISTER = 'The body must be {"name": "<name>", "slots": <1 to 8>, "repos": ["owner/name", …], "version": "<kit version>"}.';
const BAD_NEXT = 'Name the runner as `runner=<id>`.';
const BAD_REPORT = 'The body must be {"status": "running" | "done" | "failed" | "cancelled", "logTail"?, "from"? with "lines"? (at most 2,000 of 600 characters), "prUrl"?, "exitCode"?, "reason"?}.';
const BAD_LINES = 'Ask for the lines as `after=<sequence number>`, or with no query.';
const BAD_SEND = 'The body must be {"line": "/omni:<skill> <arguments>", "repo": "owner/name", "target": {"kind": "any"} | {"kind": "fleet", "fleet": "<fleet>"} | {"kind": "runner", "runner": "<id>"}}.';
const BAD_FLEET = 'The body must be {"fleet": "<fleet>"} or {"fleet": null}.';
const BAD_ID = 'No such runner or job.';

const IdSchema = z.uuid();

/** `text` as JSON, or null when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The request's body read by `schema`: its value, or null when it is too large, no JSON, or out of shape. */
async function bodyAs<T>(request: Request, schema: z.ZodType<T>, maxChars = MAX_BODY_CHARS): Promise<T | null> {
  const text = await request.text();
  const read = text.length > maxChars ? null : schema.safeParse(jsonOf(text));
  return read?.success ? read.data : null;
}

/** The runner's owner, by the kit's sign-in; a Response when refused. */
async function kitCaller(request: Request, deps: RunnersDeps): Promise<string | Response> {
  if (!deps.connect) return refuse(RUNNER_REFUSALS.unavailable, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  return auth.ok ? auth.caller.id : refuse(auth.status, auth.error);
}

/** The browser's signed-in person; a Response when refused. */
async function sessionCaller(deps: RunnersDeps): Promise<string | Response> {
  if (!deps.session) return refuse(RUNNER_REFUSALS.unavailable, NO_DATABASE);
  return (await deps.session()) ?? refuse(RUNNER_REFUSALS['signed-out'], SIGNED_OUT);
}

/** Runs `serve` for the caller and answers its value in `shape`; a refusal in its words, a failure 500. */
async function answer<T>(
  caller: string | Response, deps: RunnersDeps, shape: z.ZodType,
  serve: (service: RunnersService, caller: string) => Promise<Served<T> | Response>, wrap: (value: T) => unknown = (value) => value,
): Promise<Response> {
  if (caller instanceof Response) return caller;
  if (!deps.service) return refuse(RUNNER_REFUSALS.unavailable, NO_SERVICE);
  try {
    const served = await serve(deps.service, caller);
    if (served instanceof Response) return served;
    if (!served.ok) return refuse(RUNNER_REFUSALS[served.kind], served.error);
    return reply(200, shape.parse(wrap(served.value)));
  } catch (error) {
    deps.log(`runners: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(RUNNER_REFUSALS.database, FAILED);
  }
}

/** POST /api/runners/register: registers the runner by its name. */
export async function registerRunner(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, RegisterReplySchema, async (service, caller) => {
    const body = await bodyAs(request, RegisterRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_REGISTER) : service.register(caller, body);
  });
}

/** GET /api/runners/next?runner=<id>: the job the runner claimed within 40 s, or 204. */
export async function nextJob(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, RunnerJobSchema, async (service, caller) => {
    const query = NextQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return refuse(RUNNER_REFUSALS.malformed, BAD_NEXT);
    const served = await service.next(caller, query.data.runner);
    return served.ok && served.value === null ? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }) : served;
  });
}

/** POST /api/runners/jobs/<id>: a runner's report on a job it claimed; answers whether a cancel waits. */
export async function reportJob(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, JobUpdateReplySchema, async (service, caller) => {
    if (!IdSchema.safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, BAD_ID);
    const body = await bodyAs(request, JobUpdateSchema, MAX_REPORT_CHARS);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_REPORT) : service.update(caller, id, body);
  });
}

/** GET /api/runners/jobs/<id>/lines?after=<seq>: a job's live lines, for a member of its workspace; 404 to anyone else. */
export async function jobLines(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await sessionCaller(deps), deps, JobLinesSchema, (service, caller) => {
    if (!IdSchema.safeParse(id).success) return Promise.resolve(refuse(RUNNER_REFUSALS.missing, BAD_ID));
    const query = JobLinesQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return query.success ? service.lines(caller, id, query.data.after) : Promise.resolve(refuse(RUNNER_REFUSALS.malformed, BAD_LINES));
  });
}

/** POST /api/runners/jobs: queues a job from the browser. */
export async function sendJob(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await sessionCaller(deps), deps, JobReplySchema, async (service, caller) => {
    const body = await bodyAs(request, SendRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_SEND) : service.send(caller, body);
  }, (job) => ({ job }));
}

/** POST /api/runners/jobs/<id>/cancel: the sender or a workspace owner cancels a job. */
export async function cancelJob(id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await sessionCaller(deps), deps, JobReplySchema, (service, caller) =>
    IdSchema.safeParse(id).success ? service.cancel(caller, id) : Promise.resolve(refuse(RUNNER_REFUSALS.missing, BAD_ID)), (job) => ({ job }));
}

/** PATCH /api/runners/<id>: a workspace owner sets or clears a runner's fleet. */
export async function setRunnerFleet(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await sessionCaller(deps), deps, RunnerReplySchema, async (service, caller) => {
    if (!IdSchema.safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, BAD_ID);
    const body = await bodyAs(request, FleetRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_FLEET) : service.setFleet(caller, id, body.fleet);
  }, (runner) => ({ runner }));
}
