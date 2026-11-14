import { z } from 'zod';
import { reply } from '../business-api/reply';
import { MISSION_REFUSALS, MovedMissionSchema, type MissionAction, type MissionRefusal } from './missions.contract';
import type { Caller, MissionsReader, MissionsService } from './missions.service';

// The missions' routes (PRD 2842 s5), as plain functions of a Request, so they are tested with the real
// service on a fake database and each route stays one line:
//
//   POST /api/missions/<id>/start | pause | resume   200 {mission: {id, status}}
//
// Signed out is 401 and nothing else runs; a person who is no member of the mission's workspace (it is
// invisible to them) is 403; a move the mission's status does not allow is 409. The answer is checked
// against the contract and never cached; a failure is 500, logged.

export type MissionsDeps = {
  /** The signed-in person and what they may read, or null when nobody is signed in; null itself with no database. */
  session: (() => Promise<{ caller: Caller; reader: MissionsReader } | null>) | null;
  /** The rules over the service role, or null when this deployment has none. */
  service: MissionsService | null;
  log: (line: string) => void;
};

const NO_DATABASE = 'Missions are not available here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first.';
const BAD_ID = 'A mission\'s id is the one its page gives.';
const FAILED = 'The mission could not be moved. Try again.';

const refuse = (kind: MissionRefusal, error: string) => reply(MISSION_REFUSALS[kind], { error });

/** POST /api/missions/<id>/<action>: a member moves their workspace's mission. */
export async function moveMission(action: MissionAction, id: string, deps: MissionsDeps): Promise<Response> {
  if (!deps.session || !deps.service) return refuse('unavailable', NO_DATABASE);
  try {
    const mission = z.uuid().safeParse(id);
    const person = await deps.session();
    if (!person) return refuse('signed-out', SIGNED_OUT);
    if (!mission.success) return refuse('malformed', BAD_ID);
    const served = await deps.service.move(action, mission.data, person.caller, person.reader);
    if (!served.ok) {
      if (served.cause) deps.log(`missions: ${served.cause}`);
      return refuse(served.kind, served.error);
    }
    return reply(200, MovedMissionSchema.parse(served.value));
  } catch (error) {
    deps.log(`missions: ${error instanceof Error ? error.message : String(error)}`);
    return refuse('database', FAILED);
  }
}
