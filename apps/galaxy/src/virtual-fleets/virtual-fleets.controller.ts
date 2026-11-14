import { reply } from '../business-api/reply';
import { CreatedVirtualFleetSchema, CreateVirtualFleetRequestSchema, VIRTUAL_FLEET_REFUSALS, type RefusalField, type VirtualFleetRefusal } from './virtual-fleets.contract';
import type { VirtualFleetsService } from './virtual-fleets.service';

// The Virtual Fleets' route (PRD 2842 s1; ADR-0095), as a plain function of a Request, so it is tested
// with the real service on a fake repository and the route stays one line:
//
//   POST /api/virtual-fleets {workspace, name, mascot, roles}   201 {fleet}: the fleet as made
//
// The caller is checked first: signed out, 401, and nothing else runs. The service then acts as the
// signed-in person, so the database decides who may (any member). The answer is checked against the
// contract before it leaves, never cached; each refusal is `{error, field}` in plain words, the field
// the drawer shows it under. A failure is 500, logged.

export type VirtualFleetsDeps = {
  /** The rules as the signed-in person, or null when nobody is signed in; null itself with no database. */
  service: (() => Promise<VirtualFleetsService | null>) | null;
  log: (line: string) => void;
};

const MAX_BODY_CHARS = 8 * 1024;
const NO_DATABASE = 'Virtual fleets are not available here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The fleet could not be created. Try again.';
const BAD_CREATE = 'The body must be {"workspace": "<id>", "name": "<1 to 12 characters>", "mascot": "<a fleet mascot>", "roles": ["engineer" | "qa" | "reviewer" | "pm" | "architect", …]} with at least one role.';

/** A refusal: its status, its words and the drawer's field they go under. */
const refuse = (kind: VirtualFleetRefusal, error: string, field: RefusalField = 'form') => reply(VIRTUAL_FLEET_REFUSALS[kind], { error, field });

/** `text` as JSON, or undefined when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The body's field a contract issue names, as the drawer's field. */
function fieldOf(path: PropertyKey | undefined): RefusalField {
  if (path === 'name') return 'name';
  if (path === 'mascot') return 'mascot';
  return path === 'roles' ? 'heroes' : 'form';
}

/** POST /api/virtual-fleets: a member makes a Virtual Fleet with its heroes. */
export async function postVirtualFleet(request: Request, deps: VirtualFleetsDeps): Promise<Response> {
  if (!deps.service) return refuse('unavailable', NO_DATABASE);
  try {
    const service = await deps.service();
    if (!service) return refuse('signed-out', SIGNED_OUT);
    const text = await request.text();
    const json = text.length > MAX_BODY_CHARS ? undefined : jsonOf(text);
    if (json === null || typeof json !== 'object' || Array.isArray(json)) return refuse('malformed', BAD_CREATE);
    const read = CreateVirtualFleetRequestSchema.safeParse(json);
    if (!read.success) return refuse('invalid', BAD_CREATE, fieldOf(read.error.issues[0]?.path[0]));
    const served = await service.create(read.data);
    if (!served.ok) {
      if (served.cause) deps.log(`virtual-fleets: ${served.cause}`);
      return refuse(served.kind, served.error, served.field);
    }
    return reply(201, CreatedVirtualFleetSchema.parse(served.value));
  } catch (error) {
    deps.log(`virtual-fleets: ${error instanceof Error ? error.message : String(error)}`);
    return refuse('database', FAILED);
  }
}
