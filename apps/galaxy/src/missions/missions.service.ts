import { parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { DROP_ASKED, DROP_ASKED_KEEP, dropSet } from 'omni-loop/kit/lib/mission/drop.ts';
import { decisionsOf, overturnSentence, parseRef, refOf, type DecisionRef } from 'omni-loop/kit/lib/mission/overturn.ts';
import { MOVES, type BugsBody, type PickedBugs, type OverturnBody, type OverturnedMission, type DropBody, type DroppedMission, type LeveledMission, type MissionAction, type MissionRefusal, type MovedMission } from './missions.contract';
import { levelRefusal as planRefusal, type MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
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

/** Why `action` cannot move `mission`: it is not in a status the move takes, or Start meets `own-branch` in a plan repository (PRD 2896 s14); null otherwise. */
async function moveRefusal(action: MissionAction, mission: Parameters<MissionsReader['inPlan']>[0], reader: MissionsReader): Promise<string | null> {
  if (!MOVES[action].from.includes(mission.status)) return `${CANNOT[action]} This one is ${mission.status}.`;
  return action === 'start' ? planRefusal(mission.level, await reader.inPlan(mission)) : null;
}

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

/** Why `caller` cannot drop a PRD from `mission`'s branch at all (nothing seen, no login, no branch, not started), or null. */
function dropBlock(mission: { number: number; level: MissionLevel; status: string } | null, caller: Caller): { ok: false; kind: MissionRefusal; error: string } | null {
  if (mission === null) return { ok: false, kind: 'forbidden', error: NOT_YOURS };
  if (caller.login === null) return { ok: false, kind: 'forbidden', error: NO_LOGIN };
  if (mission.level === 'with-you') return { ok: false, kind: 'conflict', error: `Mission ${String(mission.number)} runs at with-you: it has no branch to drop a PRD from.` };
  if (!['running', 'waiting', 'paused'].includes(mission.status)) return { ok: false, kind: 'conflict', error: `Only a started mission has a branch to drop from. This one is ${mission.status}.` };
  return null;
}

/** Why `caller` cannot overturn a decision of `mission` at all (nothing seen, no login, not at alone, not started), or null. */
function overturnBlock(mission: { number: number; level: MissionLevel; status: string } | null, caller: Caller): { ok: false; kind: MissionRefusal; error: string } | null {
  if (mission === null) return { ok: false, kind: 'forbidden', error: NOT_YOURS };
  if (caller.login === null) return { ok: false, kind: 'forbidden', error: NO_LOGIN };
  if (mission.level !== 'alone') return { ok: false, kind: 'conflict', error: `Mission ${String(mission.number)} runs at ${mission.level}: the fleet decides nothing there.` };
  if (!['running', 'waiting', 'paused'].includes(mission.status)) return { ok: false, kind: 'conflict', error: `Only a started mission has decisions to overturn. This one is ${mission.status}.` };
  return null;
}

/** The events an overturn adds: the person's own, and, for a PRD on the branch, the ask that takes it off (a millisecond later, so the order is kept). */
async function recordOverturn(write: MissionsWriter, { mission, login, ref, onBranch, at }: { mission: { id: string; number: number; title: string }; login: string; ref: DecisionRef; onBranch: boolean; at: string }): Promise<void> {
  const why = ref.item === null ? 'its approval no longer counts for this mission.' : 'the item is open again for the person.';
  await write.event(mission.id, { kind: 'overturned', actor: login, prd: ref.prd, at, sentence: overturnSentence(login, ref, why) });
  if (!onBranch) return;
  await write.event(mission.id, { kind: 'drop-asked-keep', actor: login, prd: ref.prd, at: new Date(Date.parse(at) + 1).toISOString(), sentence: `${login} asked to drop only PRD ${String(ref.prd)} from ${branchOf(mission)}, having overturned the fleet.` });
}

/** The decision the fleet carried in `mission` that `name` stands for and nobody overturned yet, or why there is none. */
async function standingDecision(reader: MissionsReader, mission: { id: string; number: number }, name: string): Promise<{ ref: DecisionRef } | { error: string }> {
  const ref = parseRef(name);
  const decision = ref === null ? undefined : decisionsOf(await reader.decisionEvents(mission.id)).findLast((one) => refOf(one.ref) === refOf(ref));
  if (ref === null || decision === undefined) return { error: `The fleet carried no decision ${name} in mission ${String(mission.number)}: the mission pull request lists each.` };
  return decision.overturnedBy === null ? { ref } : { error: `${decision.overturnedBy} overturned decision ${name} already.` };
}

/** What a drop's ask says in the mission's events: who asked, what leaves the branch and the PRDs that go with it. */
function askWords(login: string, branch: string, set: { prd: PrdNumber; sharing: readonly PrdNumber[] }, keep: boolean): string {
  const taking = keep || set.sharing.length === 0 ? '' : `, with ${set.sharing.map((one) => `PRD ${String(one)}`).join(', ')}`;
  return `${login} asked to drop PRD ${String(set.prd)} from ${branch}${taking}.`;
}

/** Why `caller` cannot pick on `Decide the bugs` of `mission` at all (nothing seen, no login, not started), or null. */
function bugsBlock(mission: { status: string } | null, caller: Caller): { ok: false; kind: MissionRefusal; error: string } | null {
  if (mission === null) return { ok: false, kind: 'forbidden', error: NOT_YOURS };
  if (caller.login === null) return { ok: false, kind: 'forbidden', error: NO_LOGIN };
  if (!['running', 'waiting'].includes(mission.status)) return { ok: false, kind: 'conflict', error: `Only a started mission has bugs to decide. This one is ${mission.status}.` };
  return null;
}

/** Why a PRD has nothing to pick on at `Decide the bugs`: QA's round 2 named no bug, or a person picked already; null when it waits. */
function bugsRefusal(prd: PrdNumber, waiting: { picked: { actor: string } | null } | null): string | null {
  if (waiting === null) return `PRD ${String(prd)} has no bugs to decide.`;
  return waiting.picked === null ? null : `${waiting.picked.actor} picked on PRD ${String(prd)}'s bugs already.`;
}

/** Records a person's pick on `Decide the bugs` as their own event naming QA's round-2 job, then wakes the mission. */
async function recordPick(write: MissionsWriter, { mission, login, body, job, at }: { mission: { id: string; repo: string }; login: string; body: BugsBody; job: string; at: string }): Promise<Served<PickedBugs>> {
  const review = body.pick === 'review';
  const sentence = review ? `${login} sent PRD ${String(body.prd)} on to the Reviewer.` : `${login} stopped PRD ${String(body.prd)}.`;
  await write.event(mission.id, { kind: review ? 'resumed' : 'stopped', actor: login, prd: body.prd, job, at, sentence });
  try {
    await write.refresh(missionJob(mission.id, mission.repo));
  } catch (error) {
    return { ok: false, kind: 'database', error: 'The pick is recorded, but the mission could not be woken: it is taken on its next run.', cause: error instanceof Error ? error.message : String(error) };
  }
  return { ok: true, value: { bugs: { mission: mission.id, prd: body.prd, pick: body.pick } } };
}

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
      const refused = await moveRefusal(action, mission, reader);
      if (refused !== null) return { ok: false, kind: 'conflict', error: refused };
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
      const inPlan = planRefusal(level, await reader.inPlan(mission));
      if (inPlan !== null) return { ok: false, kind: 'conflict', error: inPlan };
      const refused = level === 'with-you' && mission.level !== 'with-you' ? landFirst(mission, await reader.joined(id)) : null;
      if (refused !== null) return { ok: false, kind: 'conflict', error: refused };
      const set = await reader.setLevel(id, level);
      return set.ok ? { ok: true, value: { mission: { id, level: set.level } } } : levelRefusal(set);
    },

    /**
     * A member asks for a PRD to leave its mission's branch (PRD 2896 s7, `omni mission drop`): the ask is recorded as an event signed
     * with their login and the mission's job woken, which removes the commit by rebase on its next run. Refused for a mission with no
     * branch (at `with-you`, a draft, delivered or stopped) and for a PRD that is not on it. The answer names the later PRDs that
     * share the PRD's territory, dropped with it unless `keep`.
     */
    async drop(body: DropBody, caller: Caller, reader: MissionsReader): Promise<Served<DroppedMission>> {
      const mission = await reader.byNumber(body.repo, body.mission);
      const blocked = dropBlock(mission, caller);
      if (blocked !== null || mission === null || caller.login === null) return blocked ?? { ok: false, kind: 'forbidden', error: NOT_YOURS };
      const branch = branchOf(mission);
      const prd = parsePrd(body.prd);
      const nothing = { ok: false as const, kind: 'conflict' as const, error: `PRD ${String(prd)} is not on ${branch}: there is nothing to drop.` };
      const order = await reader.onBranch(mission.id);
      const territories = await reader.territories(mission, order);
      const set = dropSet({ order, prd, keep: body.keep, territory: (one) => territories.get(one) ?? null });
      if (set === null) return nothing;
      await write.event(mission.id, { kind: body.keep ? DROP_ASKED_KEEP : DROP_ASKED, actor: caller.login, prd, at: iso(), sentence: askWords(caller.login, branch, set, body.keep) });
      try {
        await write.refresh(missionJob(mission.id, mission.repo));
      } catch (error) {
        return { ok: false, kind: 'database', error: 'The ask is recorded, but the mission could not be woken: it is taken on its next run.', cause: error instanceof Error ? error.message : String(error) };
      }
      return { ok: true, value: { drop: { mission: mission.id, branch, prd, sharing: set.sharing, dropped: set.dropped, keep: body.keep } } };
    },

    /**
     * A member overturns a decision the fleet carried (PRD 2896 s11, `omni mission overturn`): their `overturned` event is added beside
     * the decision, which stays as recorded, and, when the PRD sits on the mission branch, `drop-asked-keep` rides with it, so the next run
     * takes the PRD off by rebase. An approval overturned no longer counts for the mission; an answer overturned is open for the person.
     * Refused for a mission that is not at `alone` or not started, and for a decision the fleet did not carry or a person overturned already.
     */
    async overturn(body: OverturnBody, caller: Caller, reader: MissionsReader): Promise<Served<OverturnedMission>> {
      const mission = await reader.byNumber(body.repo, body.mission);
      const blocked = overturnBlock(mission, caller);
      if (blocked !== null || mission === null || caller.login === null) return blocked ?? { ok: false, kind: 'forbidden', error: NOT_YOURS };
      const found = await standingDecision(reader, mission, body.decision);
      if ('error' in found) return { ok: false, kind: 'conflict', error: found.error };
      const ref = found.ref;
      const onBranch = (await reader.onBranch(mission.id)).includes(ref.prd);
      await recordOverturn(write, { mission, login: caller.login, ref, onBranch, at: iso() });
      try {
        await write.refresh(missionJob(mission.id, mission.repo));
      } catch (error) {
        return { ok: false, kind: 'database', error: 'The overturn is recorded, but the mission could not be woken: it is taken on its next run.', cause: error instanceof Error ? error.message : String(error) };
      }
      return { ok: true, value: { overturn: { mission: mission.id, branch: onBranch ? branchOf(mission) : null, decision: refOf(ref), prd: ref.prd, onBranch } } };
    },

    /**
     * A member picks on `Decide the bugs` (PRD 3001): `Send on to the Reviewer` or `Stop this PRD`. The pick is recorded as their own
     * event, a `resumed` or a `stopped` of the PRD naming QA's round-2 job, signed with their login; the mission's job is woken, and the
     * supervisor reads the pick on its next run. Refused for a PRD with no bugs to decide, and for one a person picked on already.
     */
    async pickBugs(id: string, body: BugsBody, caller: Caller, reader: MissionsReader): Promise<Served<PickedBugs>> {
      const mission = await reader.mission(id);
      const blocked = bugsBlock(mission, caller);
      if (blocked !== null || mission === null || caller.login === null) return blocked ?? { ok: false, kind: 'forbidden', error: NOT_YOURS };
      const waiting = await reader.bugsToDecide(id, body.prd);
      const nothing = bugsRefusal(body.prd, waiting);
      if (nothing !== null || waiting === null) return { ok: false, kind: 'conflict', error: nothing ?? '' };
      return recordPick(write, { mission, login: caller.login, body, job: waiting.job, at: iso() });
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
