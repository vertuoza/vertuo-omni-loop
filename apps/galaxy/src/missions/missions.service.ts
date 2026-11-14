import { MOVES, type MissionAction, type MissionRefusal, type MovedMission } from './missions.contract';
import { missionJob, type MissionsReader, type MissionsWriter } from './missions.repository';

/** The reader a route hands the service: the controller names it through the service, never the repository (ADR-0095). */
export type { MissionsReader };

// The missions' rules (PRD 2842 s5; spec "3. The supervisor"): a member of the mission's workspace presses
// Start, Pause or Resume. Start moves a draft to running, Pause a running or waiting mission to paused,
// Resume a paused one back to running; each records its event signed with the member's login. Start and
// Resume then add or refresh the mission's job on the App's ledger, due at once (settled decision s4-01:
// a bare `background_job_wake` only brings a queued job forward, so a quiet mission would stay quiet).
// The other wakes (a job's end, a stage change, an answer) refresh it the same way. A person who cannot
// see the mission is told so as a refusal, never that it exists.

type Served<T> = { ok: true; value: T } | { ok: false; kind: MissionRefusal; error: string; cause?: string };

export const NOT_YOURS = 'Only a member of the mission\'s workspace moves it.';
export const FAILED = 'The mission could not be moved. Try again.';
const NO_LOGIN = 'Sign in with GitHub first: a mission\'s events carry the login of the member who acted.';

const CANNOT: Record<MissionAction, string> = {
  start: 'Only a draft mission starts.',
  pause: 'Only a running or waiting mission pauses.',
  resume: 'Only a paused mission resumes.',
};
const SENTENCE: Record<MissionAction, (login: string) => string> = {
  start: (login) => `${login} started the mission.`,
  pause: (login) => `${login} paused the mission: nothing new is sent.`,
  resume: (login) => `${login} resumed the mission.`,
};

/** The person who acts: their id and their GitHub login (null when they have none). */
export type Caller = { id: string; login: string | null };

export function missionsService(write: MissionsWriter, clock: { now: () => Date }) {
  const iso = () => clock.now().toISOString();

  return {
    /** Moves mission `id` as `caller`, who reads it through `reader` (so only a member sees it): the mission as moved. */
    async move(action: MissionAction, id: string, caller: Caller, reader: MissionsReader): Promise<Served<MovedMission>> {
      const mission = await reader.mission(id);
      if (mission === null) return { ok: false, kind: 'forbidden', error: NOT_YOURS };
      if (caller.login === null) return { ok: false, kind: 'forbidden', error: NO_LOGIN };
      const move = MOVES[action];
      if (!move.from.includes(mission.status)) return { ok: false, kind: 'conflict', error: `${CANNOT[action]} This one is ${mission.status}.` };
      const at = iso();
      const moved = await write.move(id, move.from, move.to, { at, startedBy: action === 'start' ? caller.id : null });
      if (!moved) return { ok: false, kind: 'conflict', error: `${CANNOT[action]} It has just moved: look again.` };
      await write.event(id, { kind: move.event, actor: caller.login, sentence: SENTENCE[action](caller.login), at });
      if (move.wakes) {
        try {
          await write.refresh(missionJob(id, mission.repo));
        } catch (error) {
          // A mission that runs with no job would never be watched: put it back where it was, and say so.
          await write.move(id, [move.to], mission.status, { at: iso(), startedBy: null });
          return { ok: false, kind: 'database', error: FAILED, cause: error instanceof Error ? error.message : String(error) };
        }
      }
      return { ok: true, value: { mission: { id, status: move.to } } };
    },

    /** Wakes mission `id` at once (a job of it ended): its job is added or refreshed, due now. Nothing for a draft, delivered or stopped mission. */
    async wake(id: string): Promise<boolean> {
      const mission = await write.mission(id);
      if (mission === null || !['running', 'waiting', 'paused'].includes(mission.status)) return false;
      await write.refresh(missionJob(id, mission.repo));
      return true;
    },

    /** Wakes every mission of `repo` that runs, waits or is paused (a stage change or an answer on one of its PRDs): how many. */
    async wakeRepo(repo: string): Promise<number> {
      const watching = await write.watching(repo);
      for (const mission of watching) await write.refresh(missionJob(mission.id, mission.repo));
      return watching.length;
    },
  };
}

export type MissionsService = ReturnType<typeof missionsService>;
