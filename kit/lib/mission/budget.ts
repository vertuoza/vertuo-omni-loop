// A mission's token budget (PRD 3040 s1, spec "2. What counts" and "3. At a cap: pause and ask once"). Pure: no clock, no
// database. The Omni app's supervisor reads the totals and the mission's latest budget stop, and asks this module what to do.
//
//   what counts      a job, once it ended, by its kept tokens: input + output + cache writes. Cache reads are left out, so a
//                    long session re-reading its context fills no cap, while a loop, which writes and outputs, does. A job
//                    with no tokens kept counts 0
//   the two caps     the mission's budget (the brief's mandate `tokens`, over every job it ever sent) and its fleet's daily
//                    cap (over the last 24 hours, read from each job's end); either one null means no cap. A cap is reached
//                    once what was spent comes to it
//   a budget stop    recorded once per cap reached, it pauses the mission and asks a person once: raise the cap, resume
//                    tomorrow (the fleet's cap only) or stop the mission. While it waits, a run records nothing new

/** A job's kept tokens, as the runner reports them (PRD 3001). */
export type TokenCounts = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** Whose cap a budget stop is: the mission's own budget, or its fleet's daily cap. */
export type BudgetCap = 'mission' | 'fleet';

/** A person's answer to a budget stop. */
export type BudgetAnswer = 'raised' | 'tomorrow' | 'stopped';

/** The fleet's window: its daily cap counts the jobs that ended in the last 24 hours. */
export const BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000;

/** What a mission run reads before it sends anything. */
export type BudgetState = {
  /** What every ended job of the mission counted. */
  missionSpent: number;
  /** The mission's budget; null for none. */
  missionCap: number | null;
  /** What the fleet's jobs that ended in the last 24 hours counted. */
  fleetSpent24h: number;
  /** The fleet's daily cap; null for none. */
  fleetCap: number | null;
  /** The cap of the latest budget stop that paused the mission; null when none did. */
  stop: BudgetCap | null;
  /** That stop's answer; null while it waits for one. */
  answer: BudgetAnswer | null;
  /** The run's time, in milliseconds. */
  now: number;
  /** When the oldest counted job of the fleet's last 24 hours ended; null when none is known. */
  oldestEnd: string | null;
};

/** What the run does about the caps. */
export type BudgetNext =
  /** Under every cap: the run goes on as it would with none. */
  | { next: 'send' }
  /** A cap is reached and no stop asks about it yet: record one stop, pause the mission, send nothing. */
  | { next: 'pause'; cap: BudgetCap; limit: number; spent: number }
  /** Its stop still waits for an answer, and its cap is still reached: send nothing, record nothing. */
  | { next: 'hold'; cap: BudgetCap }
  /** Answered `Resume tomorrow`, the fleet still at its cap: send nothing, wake at `at`. */
  | { next: 'wake-at'; at: string }
  /** Answered `Stop the mission`: it ends stopped, by the budget. */
  | { next: 'stop'; cap: BudgetCap };

/** What a job counts toward a cap: input + output + cache writes; 0 for a job with no tokens kept. */
export function spent(tokens: TokenCounts | null | undefined): number {
  return tokens ? tokens.input + tokens.output + tokens.cacheWrite : 0;
}

type Reached = { cap: BudgetCap; limit: number; spent: number };

/** The caps reached, the fleet's first: its one stop pauses every mission of the fleet. */
function reached(state: BudgetState): Reached[] {
  const caps: Reached[] = [];
  if (state.fleetCap !== null && state.fleetSpent24h >= state.fleetCap) caps.push({ cap: 'fleet', limit: state.fleetCap, spent: state.fleetSpent24h });
  if (state.missionCap !== null && state.missionSpent >= state.missionCap) caps.push({ cap: 'mission', limit: state.missionCap, spent: state.missionSpent });
  return caps;
}

/** When the fleet's window frees room: once its oldest counted job leaves it, never before now; a whole window when none is known. */
function wakeAt(now: number, oldestEnd: string | null): string {
  const oldest = oldestEnd === null ? Number.NaN : Date.parse(oldestEnd);
  const at = Number.isNaN(oldest) ? now + BUDGET_WINDOW_MS : Math.max(oldest + BUDGET_WINDOW_MS, now);
  return new Date(at).toISOString();
}

/** What a mission run does about its two caps, before it sends anything. */
export function budgetNext(state: BudgetState): BudgetNext {
  const { stop, answer } = state;
  if (stop !== null && answer === 'stopped') return { next: 'stop', cap: stop };
  const caps = reached(state);
  if (stop === 'fleet' && answer === 'tomorrow' && caps.some(({ cap }) => cap === 'fleet')) return { next: 'wake-at', at: wakeAt(state.now, state.oldestEnd) };
  if (stop !== null && answer === null && caps.some(({ cap }) => cap === stop)) return { next: 'hold', cap: stop };
  const first = caps[0];
  return first === undefined ? { next: 'send' } : { next: 'pause', ...first };
}
