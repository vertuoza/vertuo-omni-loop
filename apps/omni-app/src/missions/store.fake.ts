// The mission's store in memory (PRD 2842 s4), for the tests of its job and the fake fleet of s9: one mission, the
// facts of its PRDs, the runner jobs it sent (their keys unique, as `runner_jobs.mission_key` is) with their
// attempts, and its events. Test helpers move what a real fleet would: a job's end, a lost runner and its resume, a
// PRD's facts, a person's Pause. No database, no model call.
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { askLine, DEFAULT_BOUND, type ItemCommittee } from './answers.ts';
import { approveLine, committeeKey, type Committee, type Decision, type Recorded } from './committee.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import { baseOf, lineOf, missionKey, type Attempt, type MissionStatus, type NewEvent, type PrdFacts, type Step } from './supervisor.ts';

/** A job the fake queued, as the runner_jobs row it stands for: the build, or the Reviewer and the fix after it (PRD 2871). */
type FakeJob = { id: string; line: string; key: string; toFleet: string | null; sentByApp: string; prd: PrdNumber; run: number; step: Step; attempts: Attempt[] };

/** A recorded event, as its mission_events row. */
type FakeEvent = Omit<NewEvent, 'kind'> & { kind: string; actor: string; at: string };

const NOW_OF_ASKS = Date.parse('2027-01-22T08:00:00Z');

/** The mission's store in memory, seeded with `mission` and the facts of its PRDs. */
export function fakeMissionStore({ mission, facts, fleetRunners = true, planRepository = false, installation = 1 }: { mission: MissionRecord; facts: PrdFacts[]; fleetRunners?: boolean; planRepository?: boolean; installation?: number | null }) {
  let record: MissionRecord & { nextWakeAt: string | null } = { ...mission, nextWakeAt: null };
  let current = facts.map((fact) => ({ ...fact }));
  const jobs: FakeJob[] = [];
  /** The care jobs it queued (PRD 2896 s5), with no mission key. */
  const cares: { id: string; line: string; queuedAt: string; toFleet: string | null }[] = [];
  const events: FakeEvent[] = [];
  /** The committees it queued (PRD 2896 s9): their key, line and log, and what the database recorded for each. */
  const committees: (Committee & { key: string; line: string; toFleet: string | null; log: string | null; recorded: Recorded | null })[] = [];
  /** The item committees it queued (PRD 2896 s10), with no mission key: their line and log. */
  const asks: (Omit<ItemCommittee, 'decision'> & { line: string; toFleet: string | null; log: string | null })[] = [];
  /** What the database decides when the App records a decision: by default, what the App decided. */
  let database: (recorded: Recorded) => Decision = (recorded) => recorded.decision;
  let made = 0;
  /** Reads of the runs held until this many are waiting: two runs at once read the same state. */
  let together = 0;
  let waiting: (() => void)[] = [];

  const copyOf = (job: FakeJob) => ({ prd: job.prd, run: job.run, step: job.step, job: job.id, attempts: job.attempts.map((one) => ({ ...one })) });

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
    fleetEvents: () => Promise.resolve(events.filter(({ kind }) => kind === 'decided' || kind === 'overturned').map(({ kind, prd, sentence, link, actor }) => ({ kind, prd, sentence, link, actor }))),
    fleetRunners: () => Promise.resolve(fleetRunners),
    planRepository: () => Promise.resolve(planRepository),
    installation: () => Promise.resolve(installation),
    send: ({ mission: sent, prd, run, step, toFleet, skill }) => {
      const key = missionKey(sent.id, prd, run, step);
      if (jobs.some((job) => job.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      jobs.push({ id, line: lineOf(prd, step, skill, baseOf(sent, skill === 'ultra-yolo')), key, toFleet: toFleet ? sent.fleet : null, sentByApp: 'omni-app', prd, run, step, attempts: [{ id, status: 'queued', outcome: null, reason: null, prUrl: null }] });
      return Promise.resolve(id);
    },
    care: ({ mission: sent, line, since, toFleet }) => {
      // A job queued since `since` counts as sent: the fake queues each at the time it was asked for.
      if (cares.some((one) => one.line === line && one.queuedAt >= since)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      cares.push({ id, line, queuedAt: since, toFleet: toFleet ? sent.fleet : null });
      return Promise.resolve(id);
    },
    committees: () => Promise.resolve(committees.map(({ prd, round, job, attempt, decision }) => ({ prd, round, job, attempt: { ...attempt }, decision }))),
    committeeLog: (job) => Promise.resolve(committees.find((one) => one.job === job)?.log ?? asks.find((one) => one.job === job)?.log ?? null),
    decide: (_mission, one, recorded) => {
      const held = committees.find((each) => each.job === one.job);
      if (!held) return Promise.reject(new Error(`no committee job ${one.job}`));
      if (held.decision !== null) return Promise.resolve(held.decision);
      const decision = database(recorded);
      held.decision = decision;
      held.recorded = recorded;
      if (decision.outcome === 'carried') current = current.map((fact) => (fact.prd === one.prd ? { ...fact, approval: 'standing' } : fact));
      return Promise.resolve(decision);
    },
    asks: () => Promise.resolve(asks.map(({ prd, item, job, attempt }) => ({ prd, item, job, attempt: { ...attempt } }))),
    ask: ({ mission: sent, prd, item, toFleet }) => {
      if (asks.some((one) => one.prd === prd && one.item === item)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      asks.push({ prd, item, job: id, attempt: { id, status: 'queued', outcome: null, reason: null, prUrl: null }, line: askLine(prd, item, sent.hardToRevert ?? DEFAULT_BOUND), toFleet: toFleet ? sent.fleet : null, log: null });
      return Promise.resolve(id);
    },
    approve: ({ mission: sent, prd, round, toFleet }) => {
      const key = committeeKey(sent.id, prd, round);
      if (committees.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      committees.push({ prd, round, job: id, attempt: { id, status: 'queued', outcome: null, reason: null, prUrl: null }, decision: null, key, line: approveLine(prd), toFleet: toFleet ? sent.fleet : null, log: null, recorded: null });
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
    /** The committees queued (PRD 2896 s9), in order, with what the database recorded for each. */
    committees: () => committees.map((one) => ({ ...one })),
    /** The PRD's latest committee job ends as `change` says, its log `log`. */
    endCommittee: (prd: PrdNumber, change: Partial<Attempt>, log: string | null = null) => {
      const one = committees.filter((each) => each.prd === prd).at(-1);
      if (!one) throw new Error(`no committee of PRD ${String(prd)} was sent`);
      Object.assign(one.attempt, change);
      one.log = log;
    },
    /** The item committees queued (PRD 2896 s10), in order. */
    asks: () => asks.map((one) => ({ ...one, attempt: { ...one.attempt } })),
    /** The item's latest committee job ends as `change` says, its log `log`. */
    endAsk: (item: string, change: Partial<Attempt>, log: string | null = null) => {
      const one = asks.filter((each) => each.item === item).at(-1);
      if (!one) throw new Error(`no committee of item ${item} was sent`);
      Object.assign(one.attempt, change);
      one.log = log;
    },
    /** What the database decides from now on, as mission_decide_approval() would (a phase-0 PRD, a file changed since). */
    database: (decides: (recorded: Recorded) => Decision) => {
      database = decides;
    },
    /** The jobs queued, in order. */
    jobs: () => jobs.map((job) => ({ ...job })),
    /** The care jobs queued, in order (PRD 2896 s5). */
    cares: () => cares.map((one) => ({ ...one })),
    /** The events recorded, in order. */
    events: () => [...events],
    /** A member asked to drop the PRD from the mission branch (PRD 2896 s7), as the route records it. */
    asked: (prd: PrdNumber, { keep = false, actor = 'ada' }: { keep?: boolean; actor?: string } = {}) => {
      events.push({ kind: keep ? 'drop-asked-keep' : 'drop-asked', role: 'supervisor', prd, job: null, link: null, sentence: `${actor} asked to drop PRD ${String(prd)}.`, actor, at: new Date(NOW_OF_ASKS + events.length).toISOString() });
    },
    /** The mission as it stands. */
    mission: () => ({ ...record }),
    /** The PRD's latest job ends (or runs) as `change` says: a Reviewer's verdict with what it `posted` (PRD 2871). */
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
