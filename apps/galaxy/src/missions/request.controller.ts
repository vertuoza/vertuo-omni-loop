import { z } from 'zod';
import { reply } from '../business-api/reply';
import { MadeRequestSchema, MISSION_REFUSALS, MissionRequestSchema, RequestBodySchema, type MissionRefusal } from './missions.contract';
import type { RequestsRepository, RequestsService } from './request.service';

// The New mission box's routes (PRD omni-loop-24 s3), as plain functions of a Request, tested with the real service on the
// database in memory (request.fake.ts), so each route stays one line:
//
//   POST /api/missions {workspace, fleet, goal, repo?}  201 {request: {id, repo, fleet, goal, job}}
//   GET  /api/missions/requests/<id>                    200 {request: {id, repo, fleet, goal, requestedBy, mission, createdAt}}
//
// The POST is the page's, as the signed-in person. The GET is `omni mission request <id>`'s, as the terminal's sign-in (a runner
// signs in as its owner, a member), or the page's session when no bearer is sent. Signed out is 401 and nothing else runs; a
// malformed body or id 400; a person the rules refuse 403; a fleet, a repository or a request that is none to them 404; a phase
// 0 on a pull request, or several repositories and none named, 409. The answer is checked against the contract and never
// cached; a failure is 500, logged.

export type RequestDeps = {
  /** The signed-in person's requests, on their own client, or null when nobody is signed in; null itself with no database. */
  session: (() => Promise<RequestsRepository | null>) | null;
  /** The requests of the person behind an `Authorization: Bearer` header, or null when the token is none; null itself with no database. */
  bearer: ((authorization: string | null) => Promise<RequestsRepository | null>) | null;
  service: RequestsService;
  log: (line: string) => void;
};

const NO_DATABASE = 'Missions are not available here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first.';
const BAD_BODY = 'A new mission names the workspace, the fleet by its key, the goal (one line of 1 to 300 characters) and, when asked, the repository as owner/name.';
const BAD_ID = 'A mission request\'s id is the one its job line gives.';
const FAILED = 'The mission could not be started. Try again.';

const refuse = (kind: MissionRefusal, error: string) => reply(MISSION_REFUSALS[kind], { error });

type Served<T> = { ok: true; value: T } | { ok: false; kind: MissionRefusal; error: string; cause?: string };

/** The service's answer as the contract says, sent with `status`; a refusal in its own words, its cause logged. */
function respond<T>(served: Served<T>, status: number, schema: z.ZodType, deps: RequestDeps): Response {
  if (!served.ok) {
    if (served.cause) deps.log(`mission requests: ${served.cause}`);
    return refuse(served.kind, served.error);
  }
  return reply(status, schema.parse(served.value));
}

/** Runs a route: its own answer, or 500, logged, when anything in it throws. */
async function guarded(deps: RequestDeps, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    deps.log(`mission requests: ${error instanceof Error ? error.message : String(error)}`);
    return refuse('database', FAILED);
  }
}

/** POST /api/missions: a member presses Start on the New mission box. */
export function makeRequest(request: Request, deps: RequestDeps): Promise<Response> {
  return guarded(deps, async () => {
    if (!deps.session) return refuse('unavailable', NO_DATABASE);
    const requests = await deps.session();
    if (!requests) return refuse('signed-out', SIGNED_OUT);
    const body = RequestBodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return refuse('malformed', BAD_BODY);
    return respond(await deps.service.make(body.data, requests), 201, MadeRequestSchema, deps);
  });
}

/** GET /api/missions/requests/<id>: a member, or their runner, reads a request's goal and fleet. */
export function readRequest(id: string, request: Request, deps: RequestDeps): Promise<Response> {
  return guarded(deps, async () => {
    if (!deps.session || !deps.bearer) return refuse('unavailable', NO_DATABASE);
    const authorization = request.headers.get('authorization');
    const requests = authorization === null ? await deps.session() : await deps.bearer(authorization);
    if (!requests) return refuse('signed-out', SIGNED_OUT);
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return refuse('malformed', BAD_ID);
    return respond(await deps.service.read(parsed.data, requests), 200, MissionRequestSchema, deps);
  });
}
