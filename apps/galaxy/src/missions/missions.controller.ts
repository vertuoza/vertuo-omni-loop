import { z } from 'zod';
import { reply } from '../business-api/reply';
import { DropBodySchema, DroppedMissionSchema, OverturnBodySchema, OverturnedMissionSchema, LeveledMissionSchema, LevelBodySchema, MISSION_REFUSALS, MovedMissionSchema, type MissionAction, type MissionRefusal } from './missions.contract';
import type { Caller, MissionsReader, MissionsService } from './missions.service';

// The missions' routes (PRD 2842 s5), as plain functions of a Request, so they are tested with the real
// service on a fake database and each route stays one line:
//
//   POST /api/missions/<id>/start | pause | resume   200 {mission: {id, status}}
//   POST /api/missions/<id>/level {level}            200 {mission: {id, level}}   (PRD 2896)
//
// Signed out is 401 and nothing else runs; a person who is no member of the mission's workspace (it is
// invisible to them) is 403; a move the mission's status does not allow is 409. The answer is checked
// against the contract and never cached; a failure is 500, logged.

export type MissionsDeps = {
  /** The signed-in person and what they may read, or null when nobody is signed in; null itself with no database. */
  session: (() => Promise<{ caller: Caller; reader: MissionsReader } | null>) | null;
  /** The person behind an `Authorization: Bearer` header (the terminal's sign-in) and what they may read, or null when the token is none; null itself with no database. */
  bearer?: ((authorization: string | null) => Promise<{ caller: Caller; reader: MissionsReader } | null>) | null;
  /** The rules over the service role, or null when this deployment has none. */
  service: MissionsService | null;
  log: (line: string) => void;
};

const NO_DATABASE = 'Missions are not available here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first.';
const BAD_ID = 'A mission\'s id is the one its page gives.';
const FAILED = 'The mission could not be moved. Try again.';

const refuse = (kind: MissionRefusal, error: string) => reply(MISSION_REFUSALS[kind], { error });

/** The mission's id, the person and the service a route needs, or the refusal that ends it (signed out, a bad id, no database). */
async function ready(id: string, deps: MissionsDeps): Promise<{ id: string; person: NonNullable<Awaited<ReturnType<NonNullable<MissionsDeps['session']>>>>; service: MissionsService } | Response> {
  if (!deps.session || !deps.service) return refuse('unavailable', NO_DATABASE);
  const mission = z.uuid().safeParse(id);
  const person = await deps.session();
  if (!person) return refuse('signed-out', SIGNED_OUT);
  if (!mission.success) return refuse('malformed', BAD_ID);
  return { id: mission.data, person, service: deps.service };
}

/** What a route answers once its move is served: the contract's body, or the refusal in its words (a cause is logged). */
function answer<T>(served: { ok: true; value: T } | { ok: false; kind: MissionRefusal; error: string; cause?: string }, parse: (value: T) => unknown, deps: MissionsDeps): Response {
  if (served.ok) return reply(200, parse(served.value));
  if (served.cause) deps.log(`missions: ${served.cause}`);
  return refuse(served.kind, served.error);
}

function failed(error: unknown, deps: MissionsDeps): Response {
  deps.log(`missions: ${error instanceof Error ? error.message : String(error)}`);
  return refuse('database', FAILED);
}

/** POST /api/missions/<id>/<action>: a member moves their workspace's mission. */
export async function moveMission(action: MissionAction, id: string, deps: MissionsDeps): Promise<Response> {
  try {
    const got = await ready(id, deps);
    if (got instanceof Response) return got;
    return answer(await got.service.move(action, got.id, got.person.caller, got.person.reader), (value) => MovedMissionSchema.parse(value), deps);
  } catch (error) {
    return failed(error, deps);
  }
}

const BAD_DROP = 'A drop names the repository as owner/name, the mission\'s number and the PRD\'s.';

/** POST /api/missions/drop: a member, signed in at the terminal, asks for a PRD to leave its mission's branch (PRD 2896 s7). */
export async function dropMission(request: Request, deps: MissionsDeps): Promise<Response> {
  return fromTerminal(request, deps, { schema: DropBodySchema, bad: BAD_DROP }, (service, body, person) => service.drop(body, person.caller, person.reader), (value) => DroppedMissionSchema.parse(value));
}

/** A route of the terminal: the bearer's person, the body read through `schema`, the service's answer served as the contract says. */
async function fromTerminal<B, T>(
  request: Request,
  deps: MissionsDeps,
  { schema, bad }: { schema: z.ZodType<B>; bad: string },
  serve: (service: MissionsService, body: B, person: { caller: Caller; reader: MissionsReader }) => Promise<{ ok: true; value: T } | { ok: false; kind: MissionRefusal; error: string; cause?: string }>,
  parse: (value: T) => unknown,
): Promise<Response> {
  try {
    if (!deps.bearer || !deps.service) return refuse('unavailable', NO_DATABASE);
    const person = await deps.bearer(request.headers.get('authorization'));
    if (!person) return refuse('signed-out', SIGNED_OUT);
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) return refuse('malformed', bad);
    return answer(await serve(deps.service, body.data, person), parse, deps);
  } catch (error) {
    return failed(error, deps);
  }
}

const BAD_OVERTURN = 'An overturn names the repository as owner/name, the mission\'s number and the decision: a PRD\'s number, or <prd>/<item>.';

/** POST /api/missions/overturn: a member, signed in at the terminal, overturns a decision the fleet carried (PRD 2896 s11). */
export async function overturnMission(request: Request, deps: MissionsDeps): Promise<Response> {
  return fromTerminal(request, deps, { schema: OverturnBodySchema, bad: BAD_OVERTURN }, (service, body, person) => service.overturn(body, person.caller, person.reader), (value) => OverturnedMissionSchema.parse(value));
}

const BAD_LEVEL ='A mission\'s level is with-you, own-branch or alone.';

/** POST /api/missions/<id>/level: a member changes the level their workspace's mission runs at; the database decides who raises it. */
export async function levelMission(id: string, request: Request, deps: MissionsDeps): Promise<Response> {
  try {
    const got = await ready(id, deps);
    if (got instanceof Response) return got;
    const body = LevelBodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return refuse('malformed', BAD_LEVEL);
    return answer(await got.service.setLevel(got.id, body.data.level, got.person.caller, got.person.reader), (value) => LeveledMissionSchema.parse(value), deps);
  } catch (error) {
    return failed(error, deps);
  }
}
