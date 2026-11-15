import { MOVES, type LeveledMission, type MissionAction, type MissionRefusal, type MovedMission } from './missions.contract';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
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
const FAILED_LEVEL = 'The mission\'s level could not be changed. Try again.';
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

/** The branch a mission's PRDs sit on, as `branches.mission` shapes it: `mission/<number>-<topic>`, the topic its title's words. */
function branchOf(mission: { number: number; title: string }): string {
  const topic = mission.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40).replace(/-+$/, '');
  return `mission/${String(mission.number)}-${topic}`;
}

/** Why a mission with `joined` PRDs on its branch cannot go back to with-you, or null when none sits there. */
const landFirst = (mission: { number: number; title: string }, joined: number): string | null =>
  joined > 0 ? `Land or drop the ${String(joined)} PRD${joined === 1 ? '' : 's'} on ${branchOf(mission)} first.` : null;

/** Why a mission's level cannot be changed by `caller` at all (nothing seen, no login, over), or null. */
function levelBlock(mission: { status: string } | null, caller: Caller): { ok: false; kind: MissionRefusal; error: string } | null {
  if (mission === null) return { ok: false, kind: 'forbidden', error: NOT_YOURS };
  if (caller.login === null) return { ok: false, kind: 'forbidden', error: NO_LOGIN };
  if (mission.status === 'delivered' || mission.status === 'stopped') return { ok: false, kind: 'conflict', error: NO_LEVEL_AFTER };
  return null;
}

/** The database's refusal of a level, in the tab's words: forbidden to a member who is no owner, a conflict otherwise (its reason is logged). */
const levelRefusal = (set: { forbidden: boolean; error: string }): { ok: false; kind: MissionRefusal; error: string; cause?: string } =>
  set.forbidden
    ? { ok: false, kind: 'forbidden', error: 'Only an owner of the workspace takes a mission above its fleet\'s level.' }
    : { ok: false, kind: 'conflict', error: FAILED_LEVEL, cause: set.error };

const NO_LEVEL_AFTER = 'A delivered or stopped mission keeps the level it had.';

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

    /**
     * Sets mission `id`'s level as `caller` (Change for this mission, PRD 2896). Lowering it to `with-you` is refused
     * while a PRD sits on the mission's branch: land or drop them first. Raising it is the database's to decide: only a
     * workspace owner takes a mission above its fleet's level.
     */
    async setLevel(id: string, level: MissionLevel, caller: Caller, reader: MissionsReader): Promise<Served<LeveledMission>> {
      const mission = await reader.mission(id);
      const blocked = levelBlock(mission, caller);
      if (blocked !== null || mission === null) return blocked ?? { ok: false, kind: 'forbidden', error: NOT_YOURS };
      const refused = level === 'with-you' && mission.level !== 'with-you' ? landFirst(mission, await reader.joined(id)) : null;
      if (refused !== null) return { ok: false, kind: 'conflict', error: refused };
      const set = await reader.setLevel(id, level);
      return set.ok ? { ok: true, value: { mission: { id, level: set.level } } } : levelRefusal(set);
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
