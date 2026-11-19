// A mission run's token budget (PRD 3040 s3), before it sends anything: read through the store, decided by ./budget.ts, written
// here. ./job.ts runs the rest of the run on the mission this answers, and lets `finish` have the last word on its status.
//
//   pause    one stop recorded, unanswered: a mission's cap names the mission alone, its fleet's every mission of the fleet that
//            runs or waits, each set paused in the same run. A stop of the same cap still waiting (a replayed run, two runs at
//            once) records none and no event: the mission is paused by that one
//   events   one `budget-stop` per stop recorded, on the mission whose run recorded it, signed `supervisor` and `agent`; a
//            `paused` when a mission a person resumed by hand is paused again by the same stop; a `resumed` once its stop is
//            answered and it runs again; a `stopped` once the budget stopped it. A person's answer is their own event, recorded
//            where they answer it
//   the run  held (pause, hold, wake, stop, quiet), the mission reads as paused for the rest of the run, so nothing new is sent,
//            and no running job is touched: their ends are recorded as ever. Resumed, it runs as it would have
import { budgetAct, capReached, type BudgetAct } from './budget.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import type { Concluded, MissionStatus, NewEvent } from './supervisor.ts';

/** What the budget leaves the run: the mission it runs on, the status it read, its events, and the last word on what it concluded. */
export type BudgetRun = {
  mission: MissionRecord;
  /** The status the run read, which the mission moves from. */
  from: MissionStatus;
  /** The status the run's own events read the mission at: `stopped` once the budget stopped it, which says so itself. */
  said: MissionStatus;
  events: NewEvent[];
  finish: (next: Concluded) => Concluded;
};

const same = (next: Concluded): Concluded => next;

/** A mission the budget holds: paused for the run, then paused saying why, waking at `wakeAt` when one is set. */
function held(mission: MissionRecord, words: string, events: NewEvent[], wakeAt: string | null): BudgetRun {
  return {
    mission: { ...mission, status: 'paused', waitingOn: words },
    from: mission.status,
    said: mission.status,
    events,
    finish: (next) => (next.status === 'delivered' ? next : { status: 'paused', waitingOn: words, nextWakeAt: wakeAt }),
  };
}

/** One stop recorded and its missions paused; false when a stop of the same cap still waits, and so none was. */
async function recordStop(store: MissionStore, mission: MissionRecord, act: Extract<BudgetAct, { act: 'pause' }>): Promise<boolean> {
  const missions = act.stop.cap === 'fleet' ? await store.fleetMissions(mission) : [mission.id];
  const made = await store.stop(mission, { ...act.stop, missions });
  if (made === null) return false;
  await store.pause(missions.filter((one) => one !== mission.id), act.words);
  return true;
}

/** An event, when there is one. */
const listed = (event: NewEvent | null): NewEvent[] => (event === null ? [] : [event]);

/** A mission the budget stopped: paused for the run, then stopped, saying the budget stopped it, its own event saying so. */
const stopped = (mission: MissionRecord, words: string, event: NewEvent): BudgetRun => ({
  ...held(mission, words, [event], null),
  said: 'stopped',
  finish: (next) => (next.status === 'delivered' ? next : { status: 'stopped', waitingOn: words, nextWakeAt: null }),
});

/** Stopped, or paused by a person, over a cap: nothing new is sent, and the mission stays as it is. */
const quiet = (mission: MissionRecord): BudgetRun => ({
  mission: { ...mission, status: 'paused' },
  from: mission.status,
  said: mission.status,
  events: [],
  finish: (next) => (next.status === 'delivered' ? next : { status: mission.status, waitingOn: mission.waitingOn, nextWakeAt: null }),
});

/** What the run does on `act`, the stop already recorded or not for a pause. */
function settled(mission: MissionRecord, act: BudgetAct, recorded: boolean): BudgetRun {
  switch (act.act) {
    case 'none':
      return { mission, from: mission.status, said: mission.status, events: [], finish: same };
    case 'resume':
      return { mission: { ...mission, status: 'running', waitingOn: null }, from: mission.status, said: mission.status, events: [act.event], finish: same };
    case 'pause':
      return held(mission, act.words, recorded ? [act.event] : [], null);
    case 'hold':
      return held(mission, act.words, listed(act.event), null);
    case 'wake':
      return held(mission, act.words, listed(act.event), act.at);
    case 'stop':
      return stopped(mission, act.words, act.event);
    case 'quiet':
      return quiet(mission);
  }
}

/** The mission's token budget at `now`, before the run sends anything; `over` whether a cap is reached (PRD 3065: a retro waits). */
export async function runBudget(store: MissionStore, mission: MissionRecord, now: number): Promise<BudgetRun & { over: boolean }> {
  const read = await store.budget(mission, new Date(now));
  const act = budgetAct(read, mission, now);
  return { ...settled(mission, act, act.act === 'pause' && (await recordStop(store, mission, act))), over: capReached(read, now) };
}

/** Whether a cap of the mission or its fleet is reached at `now`: a delivered mission's retro is then skipped (PRD 3065). */
export const overCap = async (store: MissionStore, mission: MissionRecord, now: number): Promise<boolean> => capReached(await store.budget(mission, new Date(now)), now);
