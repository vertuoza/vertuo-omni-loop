import type { MadeRequest, MissionRefusal, MissionRequest, RequestBody } from './missions.contract';
import type { MakeRefusal, RequestsRepository } from './request.repository';

/** What a route hands the service: the controller names it through the service, never the repository (ADR-0095). */
export type { RequestsRepository };

// The New mission box's rules (PRD omni-loop-24 s3; spec "3. Omni page: the New mission box"). A member presses Start with a goal
// on a fleet: the request is saved, the goal word for word (BL-ASK-1), with the person who pressed it, and one runner job is
// queued for the fleet's runners, `/omni:mission --request <id>`, which writes the goal-only mission at Works alone and starts it
// as that person. The database judges, as the person, and keeps nothing when it refuses: a member who is not an owner on a fleet
// below Works alone, a repository whose phase 0 is a pull request, a fleet or a repository that is none. A request is read back,
// for `omni mission request <id>`, by the members of its workspace only: anyone else is told there is none.

type Served<T> = { ok: true; value: T } | { ok: false; kind: MissionRefusal; error: string; cause?: string };

const FAILED = 'The mission could not be started. Try again.';

/** The database's refusal of a press of Start, in its words: who may not is forbidden, what is none missing, a value or a phase 0 that does not fit a conflict. */
function refusalOf(made: MakeRefusal): { ok: false; kind: MissionRefusal; error: string; cause?: string } {
  if (made.code === '42501') return { ok: false, kind: 'forbidden', error: made.error };
  if (made.code === 'P0002') return { ok: false, kind: 'missing', error: made.error };
  if (made.code === '22023') return { ok: false, kind: made.hint === 'goal' ? 'malformed' : 'conflict', error: made.error };
  return { ok: false, kind: 'database', error: FAILED, cause: made.error };
}

export function requestsService() {
  return {
    /** Saves a press of Start as the signed-in person, through `requests` (their own client): the request and its job, or the refusal. */
    async make(body: RequestBody, requests: RequestsRepository): Promise<Served<MadeRequest>> {
      const made = await requests.make(body);
      return made.ok ? { ok: true, value: { request: made.made } } : refusalOf(made);
    },

    /** Request `id` as the signed-in person reads it, or a refusal saying there is none they may read. */
    async read(id: string, requests: RequestsRepository): Promise<Served<MissionRequest>> {
      const found = await requests.read(id);
      return found === null ? { ok: false, kind: 'missing', error: `No mission request ${id} you may read.` } : { ok: true, value: { request: found } };
    },
  };
}

export type RequestsService = ReturnType<typeof requestsService>;
