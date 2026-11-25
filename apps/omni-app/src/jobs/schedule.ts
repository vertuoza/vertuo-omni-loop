// The schedule (PRD omni-loop-3 s1, spec "A schedule"): the App's regular jobs, with no table. A schedule is a
// line here, a kind and its period; each run of the sweep (./sweep.ts, every minute) adds, for each schedule, the
// job of the current slot:
//
//   key       `<kind>@<slot start>`, the slot's start as an ISO date: the ledger's unique key per kind makes a
//             second add of the same slot a no-op, however often the sweep runs
//   lane      the kind: one job of a schedule runs at a time (background_job_claim())
//   tries     the schedule's own (`max_tries`)
//   payload   `{ slot }`, the slot's start: never a token
//   subject   the kind: what the health matches a later done job of a failed one by
//
// A slot the sweep missed is not added later: the next slot does the work, since a scheduled job reads
// everything since its last run. `background_jobs_health()` reads a schedule late when its kind has had no `done`
// job for three of its periods (./ledger.ts passes it these schedules).
//
// A laned schedule (PRD omni-loop-34 s2) runs once per lane instead, each lane's job in a lane of its own, so one
// slow lane never holds another: `supervisor-watch` every 2 minutes, one lane per workspace with a Supervisor seat
// (../supervisor/watch.ts). Its key is `<kind>:<lane>@<slot start>`, its lane `<kind>:<lane>`, its payload
// `{ slot, lane }`. It stays out of SCHEDULES: with no seat no job is added, and the health would read it late.
import type { NewJob } from './ledger.ts';

/** A regular job: its kind, how often a slot starts (slots start at midnight UTC), and its tries (1 to 5). */
export type Schedule = { kind: string; periodMinutes: number; maxTries: number };

/**
 * The App's schedules. A kind joins once its handler runs on the ledger (./pr-checks.ts), so no job is added that
 * nothing runs: the Engineering board's collector every 15 minutes (../pr-stats/job.ts) and the escalation sweep
 * every hour (../escalation/job.ts), 3 tries each (PRD omni-loop-3 s2), and the search log's categorizer every 15
 * minutes (./search-categorize.ts), 3 tries (PRD omni-loop-7 s3), the eval set's promotion and run each day
 * (./search-eval-promote.ts, ./search-eval-run.ts), 3 tries each (PRD omni-loop-8 s4), and the runners' saves'
 * forgetting every hour (./checkpoints-forget.ts), 3 tries (PRD 2809 s6), and the Commander's notebooks each day
 * (../missions/notebook-run.ts), 3 tries (PRD 3107 s4).
 */
export const SCHEDULES: readonly Schedule[] = Object.freeze([
  { kind: 'pr-stats', periodMinutes: 15, maxTries: 3 },
  { kind: 'escalation', periodMinutes: 60, maxTries: 3 },
  { kind: 'search-categorize', periodMinutes: 15, maxTries: 3 },
  { kind: 'search-eval-promote', periodMinutes: 1440, maxTries: 3 },
  { kind: 'search-eval-run', periodMinutes: 1440, maxTries: 3 },
  { kind: 'checkpoints-forget', periodMinutes: 60, maxTries: 3 },
  { kind: 'commander-notebook', periodMinutes: 1440, maxTries: 3 },
]);

/** The Supervisor's watch (PRD omni-loop-34 s2, ../supervisor/watch.ts): every 2 minutes, one lane per workspace with a seat. */
export const SUPERVISOR_WATCH: Schedule = Object.freeze({ kind: 'supervisor-watch', periodMinutes: 2, maxTries: 2 });

/** The App's laned schedules. */
export const LANED_SCHEDULES: readonly Schedule[] = Object.freeze([SUPERVISOR_WATCH]);

/** Laned schedules, and how the sweep reads their lanes (for the watch: the workspaces with a seat). */
export type Laned = { schedules: readonly Schedule[]; lanes: () => Promise<readonly string[]> };

const MINUTE = 60_000;

/** The start of the slot of `schedule` that `now` falls in, in milliseconds since the epoch. */
export function slotStart(schedule: Schedule, now: number): number {
  const period = schedule.periodMinutes * MINUTE;
  return Math.floor(now / period) * period;
}

/** The job of the current slot of each schedule. */
export function scheduledJobs(schedules: readonly Schedule[], now: number): NewJob[] {
  return schedules.map((schedule) => {
    const slot = new Date(slotStart(schedule, now)).toISOString();
    return { kind: schedule.kind, key: `${schedule.kind}@${slot}`, subject: schedule.kind, payload: { slot }, lane: schedule.kind, maxTries: schedule.maxTries };
  });
}

/** The job of the current slot of each laned schedule, one per lane. */
export function lanedJobs(schedules: readonly Schedule[], lanes: readonly string[], now: number): NewJob[] {
  return schedules.flatMap((schedule) => {
    const slot = new Date(slotStart(schedule, now)).toISOString();
    return lanes.map((lane) => ({
      kind: schedule.kind, key: `${schedule.kind}:${lane}@${slot}`, subject: schedule.kind, payload: { slot, lane }, lane: `${schedule.kind}:${lane}`, maxTries: schedule.maxTries,
    }));
  });
}

/**
 * What one sweep did to the schedule: how many jobs it asked for, and how many were new; `lanesFailed` when the
 * laned schedules' lanes could not be read (the plain schedules are added still).
 */
export type ScheduleSummary = { scheduled: number; added: number; lanesFailed?: true };

/** Adds the job of the current slot of each schedule; nothing for a slot already added. */
export async function addScheduled({
  ledger,
  schedules = SCHEDULES,
  laned,
  clock = Date.now,
}: {
  ledger: { add: (job: NewJob) => Promise<boolean> };
  schedules?: readonly Schedule[];
  /** The laned schedules and their lanes; none, only the plain schedules are added. */
  laned?: Laned;
  clock?: () => number;
}): Promise<ScheduleSummary> {
  const now = clock();
  let jobs = scheduledJobs(schedules, now);
  let lanesFailed = false;
  if (laned && laned.schedules.length > 0) {
    try {
      jobs = [...jobs, ...lanedJobs(laned.schedules, await laned.lanes(), now)];
    } catch {
      // The lanes could not be read: the plain schedules still run, and the next sweep reads them again.
      lanesFailed = true;
    }
  }
  let added = 0;
  for (const job of jobs) {
    if (await ledger.add(job)) added += 1;
  }
  return { scheduled: jobs.length, added, ...(lanesFailed ? { lanesFailed: true as const } : {}) };
}
