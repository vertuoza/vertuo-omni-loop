// The mission's store in memory (PRD 2842 s4), for the tests of its job and the fake fleet of s9: one mission, the
// facts of its PRDs, the runner jobs it sent (their keys unique, as `runner_jobs.mission_key` is) with their
// attempts, and its events. Test helpers move what a real fleet would: a job's end, a lost runner and its resume, a
// PRD's facts, a person's Pause. No database, no model call.
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import { missionKey, type Attempt, type MissionStatus, type NewEvent, type PrdFacts } from './supervisor.ts';

/** A job the fake queued, as the runner_jobs row it stands for. */
type FakeJob = { id: string; line: string; key: string; toFleet: string | null; sentByApp: string; prd: PrdNumber; run: number; attempts: Attempt[] };

/** A recorded event, as its mission_events row. */
type FakeEvent = NewEvent & { actor: 'agent'; at: string };

/** The mission's store in memory, seeded with `mission` and the facts of its PRDs. */
export function fakeMissionStore({ mission, facts, fleetRunners = true, planRepository = false }: { mission: MissionRecord; facts: PrdFacts[]; fleetRunners?: boolean; planRepository?: boolean }) {
  let record: MissionRecord & { nextWakeAt: string | null } = { ...mission, nextWakeAt: null };
  let current = facts.map((fact) => ({ ...fact }));
  const jobs: FakeJob[] = [];
  const events: FakeEvent[] = [];
  let made = 0;
  /** Reads of the runs held until this many are waiting: two runs at once read the same state. */
  let together = 0;
  let waiting: (() => void)[] = [];

  const copyOf = (job: FakeJob) => ({ prd: job.prd, run: job.run, job: job.id, attempts: job.attempts.map((one) => ({ ...one })) });

  const store: MissionStore = {
    mission: (id) => Promise.resolve(id === record.id ? { ...record } : null),
    facts: () => Promise.resolve(current.map((fact) => ({ ...fact }))),
    runs: () => {
      const snapshot = jobs.map(copyOf);
      if (together <= 1) return Promise.resolve(snapshot);
      return new Promise((resolve) => {
        waiting.push(() => {
          resolve(snapshot);
        });
        if (waiting.length >= together) {
          const release = waiting;
          waiting = [];
          together = 0;
          for (const go of release) go();
        }
      });
    },
    events: () => Promise.resolve(events.map(({ kind, prd, job }) => ({ kind, prd, job }))),
    fleetRunners: () => Promise.resolve(fleetRunners),
    planRepository: () => Promise.resolve(planRepository),
    send: ({ mission: sent, prd, run, toFleet, skill }) => {
      const key = missionKey(sent.id, prd, run);
      if (jobs.some((job) => job.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      jobs.push({ id, line: `/omni:${skill} ${String(prd)}`, key, toFleet: toFleet ? sent.fleet : null, sentByApp: 'omni-app', prd, run, attempts: [{ id, status: 'queued', outcome: null, reason: null, prUrl: null }] });
      return Promise.resolve(id);
    },
    record: (_id, list, at) => {
      for (const [n, event] of list.entries()) events.push({ ...event, actor: 'agent', at: new Date(at.getTime() + n).toISOString() });
      return Promise.resolve();
    },
    update: (_id, from, next) => {
      if (record.status !== from) return Promise.resolve(false);
      record = { ...record, status: next.status, waitingOn: next.waitingOn, nextWakeAt: next.nextWakeAt };
      return Promise.resolve(true);
    },
  };

  /** The latest attempt of the PRD's latest run. */
  const lastOf = (prd: PrdNumber): Attempt => {
    const job = jobs.filter((one) => one.prd === prd).at(-1);
    const attempt = job?.attempts.at(-1);
    if (!attempt) throw new Error(`no job of PRD ${String(prd)} was sent`);
    return attempt;
  };

  return {
    store,
    /** The jobs queued, in order. */
    jobs: () => jobs.map((job) => ({ ...job })),
    /** The events recorded, in order. */
    events: () => [...events],
    /** The mission as it stands. */
    mission: () => ({ ...record }),
    /** The PRD's latest job ends (or runs) as `change` says. */
    end: (prd: PrdNumber, change: Partial<Attempt>) => {
      Object.assign(lastOf(prd), change);
    },
    /** The PRD's latest job's runner is lost: the job fails `runner lost` and a resume of it is queued (PRD 2809). */
    lose: (prd: PrdNumber) => {
      const job = jobs.filter((one) => one.prd === prd).at(-1);
      if (!job) throw new Error(`no job of PRD ${String(prd)} was sent`);
      Object.assign(lastOf(prd), { status: 'failed', reason: 'runner lost' });
      made += 1;
      job.attempts.push({ id: `job-${String(made)}`, status: 'queued', outcome: null, reason: null, prUrl: null });
    },
    /** The PRD's facts change: a merge, a new approval, a voiding push. */
    set: (prd: PrdNumber, change: Partial<PrdFacts>) => {
      current = current.map((fact) => (fact.prd === prd ? { ...fact, ...change } : fact));
    },
    /** A person moves the mission (Start, Pause, Resume). */
    status: (status: MissionStatus) => {
      record = { ...record, status };
    },
    /** The next `count` reads of the runs wait for one another, as two runs at once would read. */
    together: (count: number) => {
      together = count;
    },
  };
}
