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
import type { NewJob } from './ledger.ts';

/** A regular job: its kind, how often a slot starts (slots start at midnight UTC), and its tries (1 to 5). */
export type Schedule = { kind: string; periodMinutes: number; maxTries: number };

/**
 * The App's schedules. A kind joins once its handler runs on the ledger (./pr-checks.ts), so no job is added that
 * nothing runs: the Engineering board's collector every 15 minutes (../pr-stats/job.ts) and the escalation sweep
 * every hour (../escalation/job.ts), 3 tries each (PRD omni-loop-3 s2), and the search log's categorizer every 15
 * minutes (./search-categorize.ts), 3 tries (PRD omni-loop-7 s3).
 */
export const SCHEDULES: readonly Schedule[] = Object.freeze([
  { kind: 'pr-stats', periodMinutes: 15, maxTries: 3 },
  { kind: 'escalation', periodMinutes: 60, maxTries: 3 },
  { kind: 'search-categorize', periodMinutes: 15, maxTries: 3 },
]);

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

/** What one sweep did to the schedule: how many schedules it asked for, and how many jobs were new. */
export type ScheduleSummary = { scheduled: number; added: number };

/** Adds the job of the current slot of each schedule; nothing for a slot already added. */
export async function addScheduled({
  ledger,
  schedules = SCHEDULES,
  clock = Date.now,
}: {
  ledger: { add: (job: NewJob) => Promise<boolean> };
  schedules?: readonly Schedule[];
  clock?: () => number;
}): Promise<ScheduleSummary> {
  let added = 0;
  for (const job of scheduledJobs(schedules, clock())) {
    if (await ledger.add(job)) added += 1;
  }
  return { scheduled: schedules.length, added };
}
