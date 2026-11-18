import { reply } from '../business-api/reply';
import { CappedFleetSchema, DailyTokensBodySchema, CreatedVirtualFleetSchema, CreateVirtualFleetRequestSchema, VIRTUAL_FLEET_REFUSALS, type RefusalField, type VirtualFleetRefusal } from './virtual-fleets.contract';
import type { VirtualFleetsService } from './virtual-fleets.service';

// The Virtual Fleets' route (PRD 2842 s1; ADR-0095), as a plain function of a Request, so it is tested
// with the real service on a fake repository and the route stays one line:
//
//   POST /api/virtual-fleets {workspace, name, mascot, roles, level?}   201 {fleet}: the fleet as made
//   POST /api/virtual-fleets/tokens {workspace, fleet, tokens}          200 {fleet: {name, dailyTokens}}: an owner sets the daily cap (PRD 3040)
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
const BAD_CREATE = 'The body must be {"workspace": "<id>", "name": "<1 to 12 characters>", "mascot": "<a fleet mascot>", "roles": ["engineer" | "qa" | "reviewer" | "pm" | "architect" | "designer", …], "level": "with-you" | "own-branch" | "alone"} with at least one role (the level is optional).';

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
  if (path === 'level') return 'level';
  return path === 'roles' ? 'heroes' : 'form';
}

/** Runs `run` for the signed-in person's service: the refusals of no database and no sign-in, and a failure logged as a 500. */
async function asPerson(deps: VirtualFleetsDeps, failed: string, run: (service: VirtualFleetsService) => Promise<Response>): Promise<Response> {
  if (!deps.service) return refuse('unavailable', NO_DATABASE);
  try {
    const service = await deps.service();
    return service ? await run(service) : refuse('signed-out', SIGNED_OUT);
  } catch (error) {
    deps.log(`virtual-fleets: ${error instanceof Error ? error.message : String(error)}`);
    return refuse('database', failed);
  }
}

/** A refused service answer in its words, its cause logged, or the answer's value as `status` and `parse` say. */
function served<T>(answer: { ok: true; value: T } | { ok: false; kind: VirtualFleetRefusal; error: string; field: RefusalField; cause?: string }, status: number, parse: (value: T) => unknown, deps: VirtualFleetsDeps): Response {
  if (answer.ok) return reply(status, parse(answer.value));
  if (answer.cause) deps.log(`virtual-fleets: ${answer.cause}`);
  return refuse(answer.kind, answer.error, answer.field);
}

/** The request's body as JSON, or undefined when it is too long or none. */
async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.text();
  return text.length > MAX_BODY_CHARS ? undefined : jsonOf(text);
}

/** POST /api/virtual-fleets: a member makes a Virtual Fleet with its heroes. */
export function postVirtualFleet(request: Request, deps: VirtualFleetsDeps): Promise<Response> {
  return asPerson(deps, FAILED, async (service) => {
    const json = await bodyOf(request);
    if (json === null || typeof json !== 'object' || Array.isArray(json)) return refuse('malformed', BAD_CREATE);
    const read = CreateVirtualFleetRequestSchema.safeParse(json);
    if (!read.success) return refuse('invalid', BAD_CREATE, fieldOf(read.error.issues[0]?.path[0]));
    return served(await service.create(read.data), 201, (value) => CreatedVirtualFleetSchema.parse(value), deps);
  });
}

const BAD_TOKENS = 'The body must be {"workspace": "<id>", "fleet": "<the fleet\'s key>", "tokens": <a whole number above 0, or null for no cap>}.';

/** POST /api/virtual-fleets/tokens: an owner of the workspace sets a Virtual Fleet's daily token cap (PRD 3040); the database decides who may. */
export function postFleetTokens(request: Request, deps: VirtualFleetsDeps): Promise<Response> {
  return asPerson(deps, 'The daily cap could not be changed. Try again.', async (service) => {
    const read = DailyTokensBodySchema.safeParse(await bodyOf(request));
    if (!read.success) return refuse('invalid', BAD_TOKENS);
    return served(await service.setDailyTokens(read.data), 200, (value) => CappedFleetSchema.parse(value), deps);
  });
}
