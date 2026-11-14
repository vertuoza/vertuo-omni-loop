// `mission` as a kind of the App's job ledger (PRD 2842 s4, spec "3. The supervisor"; ADR-0123): one job per mission,
// keyed `mission:<id>` and run in the lane `mission:<id>`, so one run of a mission happens at a time. Plain code: no
// model call, and no runner slot while it waits. Its payload names the mission and nothing else, never a token
// (L-GDPR-2).
//
//   who adds it    Start and Resume (s5) refresh it due at once (`background_job_refresh`, kind `mission`, the key,
//                  subject and lane of `missionJob`), and so does any wake: a job of the mission ending, a stage
//                  change of one of its PRDs, an answer on one of them. A refresh adds the job, brings a queued one
//                  forward, or queues a finished one again, where a bare `background_job_wake` only brings a queued
//                  one forward
//   each run       reads the mission (./store.ts); a draft runs nothing, delivered is done. Then, in order: check
//                  first (its jobs and their resumes, each PRD's approval, stage, blockers and plan), pick
//                  (./supervisor.ts), send each pick to the mission's Virtual Fleet (its runners when one holds the
//                  repository, else any runner of the workspace) under its mission key (the build, or the Reviewer
//                  and the fix after it, PRD 2871), record each decision as an event, and set the status, what it
//                  waits on and the next wake
//   how it ends    `later`, a minute on, while the mission runs or waits, or while it is paused with a job of it
//                  still running (its end is recorded); `done` otherwise. Paused sends nothing new
//   the cap        the ledger fails a job's 21st `later` in a row: before that, a run refreshes its own job (it is
//                  running, so the refresh marks it `again`), and its finish queues it at once with its count reset.
//                  The extra run reads the same state and records nothing twice
//
// A replay, or two runs at once, insert one job: the key is unique (`runner_jobs.mission_key`), so a second insert is
// refused and records nothing. The events read back give a dispatch whose event was lost its event on the next run.
import { z } from 'zod';
import type { ClaimedJob, RefreshJob } from '../jobs/ledger.ts';
import { checkPayloadOf, MissionJobDataSchema } from '../jobs/payloads.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import { conclude, eventsOf, pick, prdStates, recordedKeys, WAKE_MS, type Concluded, type Run } from './supervisor.ts';

export const MISSION_KIND = 'mission';

/** How many `later`s in a row a mission's job takes before it refreshes itself: the ledger fails the 21st. */
export const LATERS_BEFORE_RENEW = 15;

/** The job of mission `id`, in repository `repo`: due at once, in its own lane. */
export function missionJob(id: string, repo: string): RefreshJob {
  const subject = repo.toLowerCase();
  return { kind: MISSION_KIND, key: `mission:${id}`, subject, payload: { mission: id }, lane: `mission:${id}`, delaySeconds: 0 };
}

/** What an earlier run kept: how many `later`s in a row the job took. */
const ProgressSchema = z.looseObject({ laters: z.number().int().min(0).optional() });

export type MissionDeps = {
  /** The missions, as the service role; null (no database): nothing is read or sent. */
  store: MissionStore | null;
  /** Refreshes a job on the ledger: how a run resets its count of `later`s. */
  refresh: (job: RefreshJob) => Promise<unknown>;
  now?: () => number;
  log?: (line: string) => void;
};

/** What one supervising run did: the mission's new state, whether anything of it still runs, and if it moved. */
type Supervised = { next: Concluded; running: boolean; moved: boolean; sent: number; events: number };

/** One run of a running, waiting, paused or stopped mission: check, pick, send, record, set. */
async function supervise(store: MissionStore, mission: MissionRecord, now: number): Promise<Supervised> {
  const [facts, runs, recorded, toFleet] = await Promise.all([store.facts(mission), store.runs(mission.id), store.events(mission.id), store.fleetRunners(mission)]);
  const sent: Run[] = [];
  for (const { prd, run, step } of pick({ mission, facts, states: prdStates(facts, runs) })) {
    const made = await store.send({ mission, prd, run, step, toFleet });
    if (made !== null) sent.push({ prd, run, step, job: made, attempts: [{ id: made, status: 'queued', outcome: null, reason: null, prUrl: null }] });
  }
  const all = [...runs, ...sent];
  const states = prdStates(facts, all);
  const next = conclude({ mission, facts, states, sent: sent.length, now });
  const events = eventsOf({ mission, facts, states, runs: all, next, toFleet, recorded: recordedKeys(recorded) });
  await store.record(mission.id, events, new Date(now));
  const moved = await store.update(mission.id, mission.status, next);
  return { next, running: [...states.values()].some((state) => state.state === 'running'), moved, sent: sent.length, events: events.length };
}

/** Whether the mission is still watched: it runs or waits, or it is paused with a job of it still running. */
const watched = ({ next, running }: Supervised): boolean => next.status === 'running' || next.status === 'waiting' || (next.status === 'paused' && running);

/** The handler of the `mission` kind. */
export function missionHandler({ store, refresh, now = Date.now, log = noteTo('missions') }: MissionDeps): JobHandler {
  return async (job): Promise<JobResult> => {
    const { mission: id } = checkPayloadOf(MissionJobDataSchema, MISSION_KIND, job.payload);
    const mission = await runnable(store, id);
    if (!('id' in mission)) return mission;
    const at = now();
    const run = await supervise(mission.store, mission, at);
    log(`mission ${id}: ${run.next.status}, sent ${String(run.sent)}, ${String(run.events)} events${run.moved ? '' : ', its status changed meanwhile'}`);
    // A status changed meanwhile (a Pause) is read again on the next run, a minute on.
    if (!watched(run) && run.moved) return { outcome: 'done' };
    return laterOf({ job, refresh, mission, at });
  };
}

/** The mission to run, with its store; or how the run ends without one: no database, no mission, a draft, delivered. */
async function runnable(store: MissionStore | null, id: string): Promise<(MissionRecord & { store: MissionStore }) | JobResult> {
  if (!store) return { outcome: 'skipped', reason: 'no database to read the mission from' };
  const mission = await store.mission(id);
  if (!mission) return { outcome: 'skipped', reason: `no mission ${id}` };
  if (mission.status === 'draft') return { outcome: 'skipped', reason: 'the mission is a draft: nothing runs before Start' };
  return mission.status === 'delivered' ? { outcome: 'done' } : { ...mission, store };
}

/** A minute on, counting the `later`s in a row; the job refreshed, and its count reset, before the ledger's cap. */
async function laterOf({ job, refresh, mission, at }: { job: ClaimedJob; refresh: MissionDeps['refresh']; mission: MissionRecord; at: number }): Promise<JobResult> {
  const laters = (ProgressSchema.parse(job.progress ?? {}).laters ?? 0) + 1;
  if (laters < LATERS_BEFORE_RENEW) return { outcome: 'later', at: new Date(at + WAKE_MS), progress: { laters } };
  await refresh(missionJob(mission.id, mission.repo));
  return { outcome: 'later', at: new Date(at + WAKE_MS), progress: { laters: 0 } };
}
