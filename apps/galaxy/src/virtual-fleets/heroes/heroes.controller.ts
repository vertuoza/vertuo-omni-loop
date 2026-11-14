import { reply } from '../../business-api/reply';
import { AddedHeroSchema, AddHeroRequestSchema, HERO_REFUSALS, RemovedHeroSchema, RemoveHeroRequestSchema, type HeroRefusal, type HeroRefusalField } from './heroes.contract';
import type { HeroesService } from './heroes.service';

// The Heroes tab's route (PRD 2842 s6; ADR-0095), as plain functions of a Request, so they are tested
// with the real service on a fake repository and the route stays two lines:
//
//   POST   /api/virtual-fleets/heroes {workspace, fleet, role}   201 {hero}: the hero as made
//   DELETE /api/virtual-fleets/heroes {workspace, hero}          200 {removed}
//
// The caller is checked first: signed out, 401, and nothing else runs. The service then acts as the
// signed-in person, so the database decides who may (an owner). The answer is checked against the contract
// before it leaves, never cached; each refusal is `{error, field}` in plain words. A failure is 500, logged.

export type HeroesDeps = {
  /** The rules as the signed-in person, or null when nobody is signed in; null itself with no database. */
  service: (() => Promise<HeroesService | null>) | null;
  log: (line: string) => void;
};

const MAX_BODY_CHARS = 4 * 1024;
const NO_DATABASE = 'Virtual fleets are not available here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The hero could not be changed. Try again.';
const BAD_ADD = 'The body must be {"workspace": "<id>", "fleet": "<a virtual fleet\'s key>", "role": "engineer" | "qa" | "reviewer" | "pm" | "architect"}.';
const BAD_REMOVE = 'The body must be {"workspace": "<id>", "hero": "<a hero\'s id>"}.';

const refuse = (kind: HeroRefusal, error: string, field: HeroRefusalField = 'form') => reply(HERO_REFUSALS[kind], { error, field });

/** `text` as JSON, or undefined when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The body as an object, or undefined. */
async function bodyOf(request: Request): Promise<object | undefined> {
  const text = await request.text();
  const json = text.length > MAX_BODY_CHARS ? undefined : jsonOf(text);
  return json === null || typeof json !== 'object' || Array.isArray(json) ? undefined : json;
}

/** Runs `act` as the signed-in person; a failure is a 500, logged. */
async function asPerson(deps: HeroesDeps, act: (service: HeroesService) => Promise<Response>): Promise<Response> {
  if (!deps.service) return refuse('unavailable', NO_DATABASE);
  try {
    const service = await deps.service();
    return service ? await act(service) : refuse('signed-out', SIGNED_OUT);
  } catch (error) {
    deps.log(`virtual-fleets/heroes: ${error instanceof Error ? error.message : String(error)}`);
    return refuse('database', FAILED);
  }
}

/** POST /api/virtual-fleets/heroes: an owner adds the hero of a role the fleet lacks. */
export function postHero(request: Request, deps: HeroesDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const body = await bodyOf(request);
    if (!body) return refuse('malformed', BAD_ADD);
    const read = AddHeroRequestSchema.safeParse(body);
    if (!read.success) return refuse('invalid', BAD_ADD, read.error.issues[0]?.path[0] === 'role' ? 'role' : 'form');
    const served = await service.add(read.data);
    if (!served.ok) {
      if (served.cause) deps.log(`virtual-fleets/heroes: ${served.cause}`);
      return refuse(served.kind, served.error, served.field);
    }
    return reply(201, AddedHeroSchema.parse(served.value));
  });
}

/** DELETE /api/virtual-fleets/heroes: an owner removes a hero, a fleet's last one never. */
export function deleteHero(request: Request, deps: HeroesDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const body = await bodyOf(request);
    if (!body) return refuse('malformed', BAD_REMOVE);
    const read = RemoveHeroRequestSchema.safeParse(body);
    if (!read.success) return refuse('invalid', BAD_REMOVE, read.error.issues[0]?.path[0] === 'hero' ? 'hero' : 'form');
    const served = await service.remove(read.data);
    if (!served.ok) {
      if (served.cause) deps.log(`virtual-fleets/heroes: ${served.cause}`);
      return refuse(served.kind, served.error, served.field);
    }
    return reply(200, RemovedHeroSchema.parse(served.value));
  });
}
