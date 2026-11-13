// The schedule (PRD omni-loop-3 s1, spec "A schedule"): one job per slot however often the sweep asks, the
// current slot only, never a missed one.
import { describe, expect, it } from 'vitest';
import type { NewJob } from './ledger.ts';
import { addScheduled, SCHEDULES, scheduledJobs, slotStart, type Schedule } from './schedule.ts';

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

  it('holds the Engineering board’s collector every 15 minutes and the escalation every hour, 3 tries each (s2), and the search categorizer every 15 minutes (omni-loop-7 s3)', () => {
    expect(SCHEDULES).toEqual([STATS, ESCALATION, { kind: 'search-categorize', periodMinutes: 15, maxTries: 3 }]);
    expect(scheduledJobs(SCHEDULES, at('2027-01-15T09:20:00.000Z')).map((job) => job.key)).toEqual(['pr-stats@2027-01-15T09:15:00.000Z', 'escalation@2027-01-15T09:00:00.000Z', 'search-categorize@2027-01-15T09:15:00.000Z']);
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
