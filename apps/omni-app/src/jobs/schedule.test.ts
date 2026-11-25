// The schedule (PRD omni-loop-3 s1, spec "A schedule"): one job per slot however often the sweep asks, the
// current slot only, never a missed one.
import { describe, expect, it } from 'vitest';
import type { NewJob } from './ledger.ts';
import { addScheduled, LANED_SCHEDULES, lanedJobs, SCHEDULES, scheduledJobs, slotStart, SUPERVISOR_WATCH, type Schedule } from './schedule.ts';

const MINUTE = 60_000;
const at = (iso: string) => Date.parse(iso);

const STATS: Schedule = { kind: 'pr-stats', periodMinutes: 15, maxTries: 3 };
const ESCALATION: Schedule = { kind: 'escalation', periodMinutes: 60, maxTries: 3 };

/** A ledger in memory that keeps one job per kind and key, as background_job_add() does. */
function fakeLedger() {
  const jobs = new Map<string, NewJob>();
  const add = (job: NewJob) => {
    const id = `${job.kind} ${job.key}`;
    if (jobs.has(id)) return Promise.resolve(false);
    jobs.set(id, job);
    return Promise.resolve(true);
  };
  return { jobs, ledger: { add } };
}

describe('slotStart — the start of the slot a moment falls in', () => {
  it('cuts the time to the period, from midnight UTC', () => {
    expect(new Date(slotStart(STATS, at('2027-01-15T09:00:00.000Z'))).toISOString()).toBe('2027-01-15T09:00:00.000Z');
    expect(new Date(slotStart(STATS, at('2027-01-15T09:14:59.999Z'))).toISOString()).toBe('2027-01-15T09:00:00.000Z');
    expect(new Date(slotStart(STATS, at('2027-01-15T09:15:00.000Z'))).toISOString()).toBe('2027-01-15T09:15:00.000Z');
    expect(new Date(slotStart(ESCALATION, at('2027-01-15T09:59:00.000Z'))).toISOString()).toBe('2027-01-15T09:00:00.000Z');
  });
});

describe('scheduledJobs — the job of the current slot of each schedule', () => {
  it('keys each job <kind>@<slot start>, in the lane of its kind, with its tries; its slot in the payload', () => {
    expect(scheduledJobs([STATS, ESCALATION], at('2027-01-15T09:20:00.000Z'))).toEqual([
      { kind: 'pr-stats', key: 'pr-stats@2027-01-15T09:15:00.000Z', subject: 'pr-stats', payload: { slot: '2027-01-15T09:15:00.000Z' }, lane: 'pr-stats', maxTries: 3 },
      { kind: 'escalation', key: 'escalation@2027-01-15T09:00:00.000Z', subject: 'escalation', payload: { slot: '2027-01-15T09:00:00.000Z' }, lane: 'escalation', maxTries: 3 },
    ]);
  });

  it('holds the Engineering board’s collector every 15 minutes and the escalation every hour, 3 tries each (s2), the search categorizer every 15 minutes (omni-loop-7 s3), the eval set\'s promotion and run each day (omni-loop-8 s4), the saves\' forgetting every hour (PRD 2809 s6), and the Commander\'s notebooks each day (PRD 3107 s4)', () => {
    expect(SCHEDULES).toEqual([
      STATS,
      ESCALATION,
      { kind: 'search-categorize', periodMinutes: 15, maxTries: 3 },
      { kind: 'search-eval-promote', periodMinutes: 1440, maxTries: 3 },
      { kind: 'search-eval-run', periodMinutes: 1440, maxTries: 3 },
      { kind: 'checkpoints-forget', periodMinutes: 60, maxTries: 3 },
      { kind: 'commander-notebook', periodMinutes: 1440, maxTries: 3 },
    ]);
    expect(scheduledJobs(SCHEDULES, at('2027-01-15T09:20:00.000Z')).map((job) => job.key)).toEqual(['pr-stats@2027-01-15T09:15:00.000Z', 'escalation@2027-01-15T09:00:00.000Z', 'search-categorize@2027-01-15T09:15:00.000Z', 'search-eval-promote@2027-01-15T00:00:00.000Z', 'search-eval-run@2027-01-15T00:00:00.000Z', 'checkpoints-forget@2027-01-15T09:00:00.000Z', 'commander-notebook@2027-01-15T00:00:00.000Z']);
  });
});

describe('addScheduled — what the sweep adds, on a fixed clock', () => {
  it('adds one job per slot however often it is asked', async () => {
    const { jobs, ledger } = fakeLedger();
    let now = at('2027-01-15T09:00:30.000Z');
    const clock = () => now;
    // The sweep every minute, through a quarter of an hour and one more minute.
    const summaries = [];
    for (let minute = 0; minute <= 15; minute += 1) {
      summaries.push(await addScheduled({ ledger, schedules: [STATS, ESCALATION], clock }));
      now += MINUTE;
    }
    expect([...jobs.keys()]).toEqual([
      'pr-stats pr-stats@2027-01-15T09:00:00.000Z',
      'escalation escalation@2027-01-15T09:00:00.000Z',
      'pr-stats pr-stats@2027-01-15T09:15:00.000Z',
    ]);
    expect(summaries[0]).toEqual({ scheduled: 2, added: 2 });
    expect(summaries[1]).toEqual({ scheduled: 2, added: 0 });
    expect(summaries[15]).toEqual({ scheduled: 2, added: 1 });
  });

  it('adds nothing for a slot it missed: after a gap, only the current slot', async () => {
    const { jobs, ledger } = fakeLedger();
    let now = at('2027-01-15T09:01:00.000Z');
    await addScheduled({ ledger, schedules: [STATS], clock: () => now });
    now = at('2027-01-15T10:02:00.000Z');  // 09:15, 09:30 and 09:45 were missed
    await addScheduled({ ledger, schedules: [STATS], clock: () => now });
    expect([...jobs.keys()]).toEqual(['pr-stats pr-stats@2027-01-15T09:00:00.000Z', 'pr-stats pr-stats@2027-01-15T10:00:00.000Z']);
  });

  it('with no schedule, adds nothing and asks nothing', async () => {
    const add = () => Promise.reject(new Error('no add expected'));
    expect(await addScheduled({ ledger: { add }, schedules: [], clock: () => at('2027-01-15T09:00:00.000Z') })).toEqual({ scheduled: 0, added: 0 });
  });
});

describe('a laned schedule — one job per lane, each lane its own (PRD omni-loop-34 s2)', () => {
  const W1 = '11111111-1111-4111-8111-111111111111';
  const W2 = '22222222-2222-4222-8222-222222222222';

  it('holds the Supervisor\'s watch every 2 minutes, 2 tries, kept out of SCHEDULES so the health never reads it late with no seat', () => {
    expect(SUPERVISOR_WATCH).toEqual({ kind: 'supervisor-watch', periodMinutes: 2, maxTries: 2 });
    expect(LANED_SCHEDULES).toEqual([SUPERVISOR_WATCH]);
    expect(SCHEDULES.map((schedule) => schedule.kind)).not.toContain('supervisor-watch');
  });

  it('keys each job <kind>:<lane>@<slot start>, in the lane <kind>:<lane>, the lane and the slot in its payload', () => {
    expect(lanedJobs([SUPERVISOR_WATCH], [W1, W2], at('2027-01-15T09:03:10.000Z'))).toEqual([
      { kind: 'supervisor-watch', key: `supervisor-watch:${W1}@2027-01-15T09:02:00.000Z`, subject: 'supervisor-watch', payload: { slot: '2027-01-15T09:02:00.000Z', lane: W1 }, lane: `supervisor-watch:${W1}`, maxTries: 2 },
      { kind: 'supervisor-watch', key: `supervisor-watch:${W2}@2027-01-15T09:02:00.000Z`, subject: 'supervisor-watch', payload: { slot: '2027-01-15T09:02:00.000Z', lane: W2 }, lane: `supervisor-watch:${W2}`, maxTries: 2 },
    ]);
  });

  it('adds one job per lane and slot however often the sweep asks; no lane, no job', async () => {
    const { jobs, ledger } = fakeLedger();
    let now = at('2027-01-15T09:00:30.000Z');
    let lanes: string[] = [];
    const laned = { schedules: [SUPERVISOR_WATCH], lanes: () => Promise.resolve(lanes) };
    expect(await addScheduled({ ledger, schedules: [], laned, clock: () => now })).toEqual({ scheduled: 0, added: 0 });
    lanes = [W1];
    expect(await addScheduled({ ledger, schedules: [], laned, clock: () => now })).toEqual({ scheduled: 1, added: 1 });
    now += MINUTE;
    expect(await addScheduled({ ledger, schedules: [], laned, clock: () => now })).toEqual({ scheduled: 1, added: 0 });
    now += MINUTE;
    expect(await addScheduled({ ledger, schedules: [STATS], laned, clock: () => now })).toEqual({ scheduled: 2, added: 2 });
    expect([...jobs.keys()]).toEqual([
      `supervisor-watch supervisor-watch:${W1}@2027-01-15T09:00:00.000Z`,
      'pr-stats pr-stats@2027-01-15T09:00:00.000Z',
      `supervisor-watch supervisor-watch:${W1}@2027-01-15T09:02:00.000Z`,
    ]);
  });

  it('a lanes read that fails adds the plain schedules still, and says the lanes failed', async () => {
    const { jobs, ledger } = fakeLedger();
    const laned = { schedules: [SUPERVISOR_WATCH], lanes: () => Promise.reject(new Error('the database refused')) };
    expect(await addScheduled({ ledger, schedules: [STATS], laned, clock: () => at('2027-01-15T09:00:30.000Z') })).toEqual({ scheduled: 1, added: 1, lanesFailed: true });
    expect([...jobs.keys()]).toEqual(['pr-stats pr-stats@2027-01-15T09:00:00.000Z']);
  });
});
