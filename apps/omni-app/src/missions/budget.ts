// What a mission run does about its token budget (PRD 3040 s3, spec "3. At a cap: pause and ask once"). Pure: no clock, no
// database. ./budget-run.ts reads the caps, the stops and the person's own Pause and Resume, asks this module, then writes.
//
//   the stop read     the latest budget stop that names the mission, or its fleet's stop still waiting for an answer when that one is
//                     newer: a mission the fleet's stop did not name (a person had paused it) is held by it once resumed. A stop a
//                     person answered `Stop the mission` no longer holds once that person, or another, resumed the mission after
//   paused by budget  the mission is paused, and the budget paused it last: its stop, or the supervisor pausing it again, came after a
//                     person's own Pause. A mission a person paused is never resumed by the budget, and never asked about
//   the acts          the kit's budgetNext() (kit/lib/mission/budget.ts) says send, pause, hold, wake-at or stop; this module says it of
//                     this mission, by its status:
//
//                       none     the run goes on as it would with no cap
//                       resume   paused by the budget, its stop answered (raised, or tomorrow once the window freed room), or no stop
//                                holding it any more: it runs again, saying why
//                       pause    running or waiting (or paused by the budget, the raise not enough): record one stop, pause, send nothing
//                       hold     its stop still waits, its cap still reached: send nothing, record no stop; a mission resumed by hand
//                                is paused again by the same stop, saying so
//                       wake     answered Resume tomorrow, the fleet still at its cap: paused, waking at the time the window frees room
//                       stop     answered Stop the mission: it ends stopped, saying the budget stopped it
//                       quiet    stopped, or paused by a person, over a cap: it sends nothing, and nothing of it changes
//
// A running job is never cancelled: no act cancels anything, and its tokens count once it ends.
import { budgetNext, type BudgetAnswer, type BudgetCap } from 'omni-loop/kit/lib/mission/budget.ts';
import type { MissionStatus, NewEvent } from './supervisor.ts';

/** A budget stop, as the run reads it (`mission_budget_stops`). */
export type StopRow = {
  id: string;
  cap: BudgetCap;
  capTokens: number;
  spent: number;
  missions: readonly string[];
  answer: BudgetAnswer | null;
  raisedTo: number | null;
  createdAt: string;
  answeredAt: string | null;
};

/** What a run reads before it sends anything (PRD 3040). */
export type BudgetRead = {
  /** What every ended job of the mission counted (input + output + cache writes). */
  missionSpent: number;
  /** The mission's budget (its mandate's `tokens`); null for none. */
  missionCap: number | null;
  /** What the fleet's jobs that ended in the last 24 hours counted, and when the oldest of them ended. */
  fleetSpent24h: number;
  /** The fleet's daily cap (`teams.daily_tokens`); null for none. */
  fleetCap: number | null;
  oldestEnd: string | null;
  /** The latest stop that names the mission; null when none does. */
  named: StopRow | null;
  /** The fleet's stop still waiting for its answer; null when none does. */
  open: StopRow | null;
  /** When a person last paused, and resumed, the mission itself; when the supervisor last paused it again. */
  personPausedAt: string | null;
  personResumedAt: string | null;
  agentPausedAt: string | null;
};

/** A stop to record: whose cap, its value and what was spent. The run names the missions it pauses. */
export type NewStop = { cap: BudgetCap; capTokens: number; spent: number };

export type BudgetAct =
  | { act: 'none' }
  | { act: 'resume'; event: NewEvent }
  | { act: 'pause'; stop: NewStop; words: string; event: NewEvent }
  | { act: 'hold'; words: string; event: NewEvent | null }
  | { act: 'wake'; at: string; words: string; event: NewEvent | null }
  | { act: 'stop'; words: string; event: NewEvent }
  | { act: 'quiet' };

// ── The tokens, in words ─────────────────────────────────────────────────────────

const trimmed = (n: number): string => n.toFixed(1).replace(/\.0$/, '');

/** What was spent: `950`, `1.1k`, `412k`, `1.3M`, `2.0M`. */
export const spentWords = (n: number): string => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${trimmed(n / 1000)}k` : String(n));

/** A cap: `500`, `1k`, `1.5M`, `2M`. */
export const capWords = (n: number): string => (n >= 1_000_000 ? `${trimmed(n / 1_000_000)}M` : n >= 1000 ? `${trimmed(n / 1000)}k` : String(n));

/** Whose cap, as the mission's page says it. */
const WHOSE: Readonly<Record<BudgetCap, string>> = { mission: "this mission's budget", fleet: "this fleet's daily cap" };

/** What the mission waits on while its budget holds it: `Paused: budget reached · 2.0M of 2M tokens · this mission's budget`. */
function pausedWords(cap: BudgetCap, limit: number, spent: number): string {
  const window = cap === 'fleet' ? ' in the last 24 hours' : '';
  return `Paused: budget reached · ${spentWords(spent)} of ${capWords(limit)} tokens${window} · ${WHOSE[cap]}`;
}

/** `09:00` of an ISO time, in UTC. */
const clockOf = (iso: string): string => new Date(iso).toISOString().slice(11, 16);

/** A supervisor's event about the mission itself, signed `agent` by the store. */
const said = (kind: NewEvent['kind'], sentence: string): NewEvent => ({ kind, role: 'supervisor', prd: null, job: null, link: null, sentence });

// ── The reads, made plain ────────────────────────────────────────────────────────

const time = (iso: string | null): number => (iso === null ? Number.NEGATIVE_INFINITY : Date.parse(iso));

/** The stop the run reads: the fleet's open one when newer than the latest naming the mission; none once a person resumed a stopped one. */
function stopOf(read: BudgetRead): StopRow | null {
  const { named, open } = read;
  const latest = open !== null && (named === null || time(open.createdAt) >= time(named.createdAt)) ? open : named;
  if (latest?.answer === 'stopped' && time(read.personResumedAt) > time(latest.answeredAt)) return null;
  return latest;
}

/** Whether the budget paused the mission last: its stop, or the supervisor pausing it again, after a person's own Pause. */
function pausedByBudget(read: BudgetRead, status: MissionStatus): boolean {
  if (status !== 'paused') return false;
  const budgetAt = Math.max(time(read.named?.createdAt ?? null), time(read.agentPausedAt));
  return budgetAt > Number.NEGATIVE_INFINITY && budgetAt > time(read.personPausedAt);
}

// ── The acts ─────────────────────────────────────────────────────────────────────

/** Why a mission paused by the budget runs again. */
function resumeWords(stop: StopRow | null, read: BudgetRead): string {
  if (stop?.answer === 'raised' && stop.raisedTo !== null) return `Resumed: ${WHOSE[stop.cap]} was raised to ${capWords(stop.raisedTo)}.`;
  if (stop?.answer === 'tomorrow' && read.fleetCap !== null) return `Resumed: this fleet's last 24 hours are back under its daily cap (${capWords(read.fleetCap)}).`;
  return 'Resumed: no cap is reached any more.';
}

/** The cap's value and what was spent against it, as the run read them. */
const against = (cap: BudgetCap, read: BudgetRead): { limit: number; spent: number } =>
  cap === 'fleet' ? { limit: read.fleetCap ?? 0, spent: read.fleetSpent24h } : { limit: read.missionCap ?? 0, spent: read.missionSpent };

/** Under every cap: a mission the budget paused runs again once nothing holds it, or stays paused while its question waits. */
function sendAct(stop: StopRow | null, read: BudgetRead, byBudget: boolean): BudgetAct {
  if (!byBudget) return { act: 'none' };
  return stop !== null && stop.answer === null ? { act: 'quiet' } : { act: 'resume', event: said('resumed', resumeWords(stop, read)) };
}

/** A cap reached and no stop asking about it: one stop, the mission paused. */
const pauseAct = ({ cap, limit, spent }: { cap: BudgetCap; limit: number; spent: number }): BudgetAct => ({
  act: 'pause',
  stop: { cap, capTokens: limit, spent },
  words: pausedWords(cap, limit, spent),
  event: said('budget-stop', `Paused: ${WHOSE[cap]} reached (${capWords(limit)})`),
});

/** Its stop still waits, its cap still reached: paused by the same stop; again, saying so, when a person resumed it by hand. */
function holdAct(cap: BudgetCap, read: BudgetRead, moving: boolean): BudgetAct {
  const { limit, spent } = against(cap, read);
  const again = moving ? said('paused', `Paused again: ${WHOSE[cap]} is still reached (${capWords(limit)}); its question waits for an answer.`) : null;
  return { act: 'hold', words: pausedWords(cap, limit, spent), event: again };
}

/** Answered Resume tomorrow, the fleet still at its cap: paused until the window frees room. */
function wakeAct(at: string, moving: boolean): BudgetAct {
  const words = `Paused: budget reached · ${WHOSE.fleet} · resumes by itself at ${clockOf(at)} UTC`;
  const again = moving ? said('paused', `Paused again: this fleet's daily cap is still reached; it resumes by itself at ${clockOf(at)} UTC.`) : null;
  return { act: 'wake', at, words, event: again };
}

/** Answered Stop the mission: it ends stopped, saying the budget stopped it; a mission stopped already stays as it is. */
function stopAct(cap: BudgetCap, stop: StopRow | null, status: MissionStatus): BudgetAct {
  if (status === 'stopped') return { act: 'quiet' };
  const why = `${WHOSE[cap]} reached (${capWords(stop?.capTokens ?? 0)}), and a person chose Stop the mission.`;
  return { act: 'stop', words: `Stopped by the budget: ${why}`, event: said('stopped', `The budget stopped the mission: ${why}`) };
}

/** What a run does about the mission's two caps, before it sends anything. */
export function budgetAct(read: BudgetRead, mission: { id: string; status: MissionStatus }, now: number): BudgetAct {
  const stop = stopOf(read);
  const byBudget = pausedByBudget(read, mission.status);
  const moving = mission.status === 'running' || mission.status === 'waiting';
  const next = budgetNext({ ...read, stop: stop?.cap ?? null, answer: stop?.answer ?? null, now });
  if (next.next === 'send') return sendAct(stop, read, byBudget);
  if (next.next === 'stop') return stopAct(next.cap, stop, mission.status);
  // A mission stopped, or paused by a person, is never asked about: it sends nothing, and nothing of it changes.
  if (!moving && !byBudget) return { act: 'quiet' };
  if (next.next === 'pause') return pauseAct(next);
  return next.next === 'hold' ? holdAct(next.cap, read, moving) : wakeAct(next.at, moving);
}
