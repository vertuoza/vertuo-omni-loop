// The PM plans and replans in a mission's run (PRD omni-loop-21 s9, spec "3. The PM plans and replans"): pure functions over what
// one run read, laid over where ./supervisor.ts put each PRD. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   plan       at `alone`, a PRD whose approval goes to its committee and that has no plan on its page is planned first: the PM is
//              sent `/omni:plan <n>` (kit/lib/virtual-fleet/pm.ts), once, and no committee is sent while it plans. Once a plan is on
//              its page, its committee is sent as for any PRD, the PM sitting out (`--author pm`). A plan job that ended with no
//              plan on the page waits for a person
//   replan     at `alone`, a PRD stopped once its repairs are spent (its cause repaired 3 times in the round, or the mission's 9
//              spent: BR-PRODUCT-139) is replanned, once: the PM is sent `/omni:plan <n> --replan` for its slices not merged yet.
//              Once it ended, a committee approves the new plan version, the PM sitting out, under the PRD's next committee round;
//              carried, the PRD is built again, its next run; refused, it stops, saying why, and the mission's retro is sent (PRD
//              3065). A replan that failed stops it too. After the PRD was built again, nothing here holds it: a second stop stays
//              stopped
//   the order  which committee and which run came after the replan is read from the mission's events in the order they happened:
//              the replan's end is recorded before anything sent after it, and a job this run sent is not recorded yet
//   the keys   a plan job is a PM job (`mission:<id>:pm:<k>`), its round after every PM job's, round 1 kept for the PM's own PRDs;
//              its line names its PRD and kind, so a replay sends none twice
//   the events the dispatch, signed `supervisor`; its end, signed `pm`; all by `agent`, never in a person's name
import { isProductPrdId, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { planJobLine, planOfLine, type PlanKind } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import type { Committee } from './committee.ts';
import { PM_ROUND, pmWorking, type PmJob } from './pm.ts';
import { leftOf, type RepairView } from './repair.ts';
import { after, type NewEvent, type PrdFacts, type PrdState, type RecordedEvent, type Run } from './supervisor.ts';

/** A plan job the mission sent its PM: a PM job whose line plans a PRD of its scope. */
export type PlanJob = PmJob & { prd: PrdNumber; kind: PlanKind };

/**
 * The PM's plan jobs among its jobs, each with the PRD and kind its line names. A product PRD's is left out: the run reads a
 * repository PRD only until it takes products (PRD omni-loop-21 s9b).
 */
export function planJobsOf(jobs: readonly PmJob[]): PlanJob[] {
  return jobs.flatMap((job) => {
    const planned = planOfLine(job.line);
    return planned === null || isProductPrdId(planned.prd) ? [] : [{ ...job, prd: planned.prd, kind: planned.kind }];
  });
}

/** The round of the next plan job: after every PM job's, round 1 kept for the PM's own PRDs. */
export const nextPlanRound = (jobs: readonly Pick<PmJob, 'round'>[]): number => Math.max(PM_ROUND, ...jobs.map((job) => job.round)) + 1;

/** The PRDs the PM planned or replanned, its job done: the PM sits out their committees. */
export const plannedOf = (plans: readonly PlanJob[]): Set<PrdNumber> => new Set(plans.filter((plan) => plan.attempt.status === 'done').map((plan) => plan.prd));

/** What the overlay reads: the mission's level, its PRDs, its runs, committees, plan jobs, events in order and repairs. */
export type PlanAt = {
  alone: boolean;
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  committees: readonly Committee[];
  plans: readonly PlanJob[];
  recorded: readonly RecordedEvent[];
  repairs: RepairView;
};

/** A plan job to send: its PRD and kind. */
export type PlanSend = { prd: PrdNumber; kind: PlanKind };

/** Where each PRD is once the PM's plans are laid over it, the plan jobs to send, and whether a refused replan sends the retro. */
type Planned = { states: Map<PrdNumber, PrdState>; send: PlanSend[]; retro: boolean };

/** What the overlay makes of one PRD: its state, and a plan job to send or the retro; null to keep the state as it was. */
type Over = { state: PrdState; send?: PlanKind; retro?: boolean } | null;

/**
 * Whether a stopped PRD stopped because its repairs are spent (BR-PRODUCT-139): its latest job's failure (`failed`) got no repair as
 * the mission had none left, or its latest repair was refused by the budget (its cause's 3, or the mission's 9). A PRD a repair stopped
 * for a person, an Omni Loop bug or a fix that cannot land is not: a new plan would not help it.
 */
function repairsSpent(repairs: RepairView, prd: PrdNumber, failed: string | undefined): boolean {
  if (repairs.budget === 0 || failed === undefined) return false;
  const mine = repairs.jobs.filter((job) => job.prd === prd && job.failedJob === failed);
  const last = mine.reduce<(typeof mine)[number] | undefined>((latest, job) => (latest === undefined || job.k > latest.k ? job : latest), undefined);
  return last === undefined ? leftOf(repairs) === 0 : repairs.refused.has(last.job);
}

/** The PRD's latest job: the last attempt of its latest run, by run and step; undefined when it has none. */
const latestJobOf = (runs: readonly Run[], prd: PrdNumber): string | undefined =>
  runs.filter((one) => one.prd === prd).reduce<Run | undefined>((latest, one) => (latest === undefined || after(one, latest) ? one : latest), undefined)?.attempts.at(-1)?.id;

/** The latest of `plans` of PRD `prd` and kind `kind`, by round; undefined when none. */
const latestPlan = (plans: readonly PlanJob[], prd: PrdNumber, kind: PlanKind): PlanJob | undefined =>
  plans.filter((plan) => plan.prd === prd && plan.kind === kind).reduce<PlanJob | undefined>((last, plan) => (last === undefined || plan.round > last.round ? plan : last), undefined);

/** The PRD's committees' latest round; 0 when none was sent. */
const roundOf = (committees: readonly Committee[]): number => Math.max(0, ...committees.map((one) => one.round));

/** Where job `job`'s event of kind `kind` sits in the mission's events; -1 when none was recorded. */
const placeOf = (recorded: readonly RecordedEvent[], job: string, kind: string): number => recorded.findIndex((event) => event.job === job && event.kind === kind);

/** Whether job `job` was sent after the event at `place`: its dispatch recorded after it, or not recorded yet (sent this run). */
const sentAfter = (recorded: readonly RecordedEvent[], job: string, place: number): boolean => {
  const sent = placeOf(recorded, job, 'dispatched');
  return sent === -1 || sent > place;
};

/** A PRD with no plan on its page whose approval goes to its committee: planned first, its committee once the plan is on it. */
function planFirst(fact: PrdFacts, state: PrdState, at: PlanAt, committees: readonly Committee[]): Over {
  if (state.state !== 'approvable' || fact.territory !== null) return null;
  const plan = latestPlan(at.plans, fact.prd, 'plan');
  const deciding: PrdState = { state: 'deciding', round: Math.max(1, roundOf(committees)) };
  if (plan === undefined) return { state: deciding, send: 'plan' };
  if (pmWorking(plan)) return { state: deciding };
  return { state: { state: 'waits', on: 'approve', why: `the PM's /omni:plan ${String(fact.prd)} ended and no plan is on its page` } };
}

/** A replan sent for a stopped PRD: at work, its committee, the PRD built again, or stopped. Null once it was built again. */
function afterReplan(fact: PrdFacts, replan: PlanJob, at: PlanAt, committees: readonly Committee[]): Over {
  const deciding: PrdState = { state: 'deciding', round: Math.max(1, roundOf(committees)) };
  if (pmWorking(replan)) return { state: deciding };
  const ended = placeOf(at.recorded, replan.job, 'job-ended');
  if (ended === -1) return { state: deciding };
  const runs = at.runs.filter((one) => one.prd === fact.prd);
  if (runs.some((one) => sentAfter(at.recorded, one.job, ended))) return null;
  if (replan.attempt.status !== 'done') return { state: { state: 'stopped', why: `its repairs are spent, and the PM's replan ${replan.attempt.status === 'cancelled' ? 'was cancelled' : 'failed'}` } };
  return approvedAgain(committees.filter((one) => sentAfter(at.recorded, one.job, ended)), roundOf(committees), runs);
}

/**
 * A replan done, by the committees sent after it ended (`since`): its committee to send under the PRD's next round (after `round`),
 * at work, carried (the PRD built again, its next run) or refused (stopped, the retro sent).
 */
function approvedAgain(since: readonly Committee[], round: number, runs: readonly Run[]): Over {
  const latest = since.reduce<Committee | undefined>((last, one) => (last === undefined || one.round > last.round ? one : last), undefined);
  if (latest === undefined) return { state: { state: 'approvable', round: round + 1 } };
  if (latest.decision === null) return { state: { state: 'deciding', round: latest.round } };
  if (latest.decision.outcome === 'carried') return { state: { state: 'startable', run: Math.max(0, ...runs.map((one) => one.run)) + 1, step: 'build' } };
  const why = latest.decision.why.length > 0 ? `: ${latest.decision.why.join('; ')}` : '';
  return { state: { state: 'stopped', why: `the committee refused its new plan${why}` }, retro: true };
}

/** A PRD stopped once its repairs are spent: replanned, once. */
function replanned(fact: PrdFacts, state: PrdState, at: PlanAt, committees: readonly Committee[]): Over {
  if (state.state !== 'stopped') return null;
  const replan = latestPlan(at.plans, fact.prd, 'replan');
  if (replan !== undefined) return afterReplan(fact, replan, at, committees);
  if (!repairsSpent(at.repairs, fact.prd, latestJobOf(at.runs, fact.prd))) return null;
  return { state: { state: 'deciding', round: Math.max(1, roundOf(committees)) }, send: 'replan' };
}

/**
 * Where each PRD is once the PM's plans are laid over `states` (./supervisor.ts's), at `alone` only: a PRD with no plan is planned
 * before its approval, and one stopped once its repairs are spent is replanned. Below `alone`, `states` as they are.
 */
export function withPlans(states: ReadonlyMap<PrdNumber, PrdState>, at: PlanAt): Planned {
  const out = new Map(states);
  const send: PlanSend[] = [];
  let retro = false;
  if (!at.alone) return { states: out, send, retro };
  for (const fact of at.facts) {
    const state = states.get(fact.prd);
    if (state === undefined) continue;
    const committees = at.committees.filter((one) => one.prd === fact.prd);
    const over = planFirst(fact, state, at, committees) ?? replanned(fact, state, at, committees);
    if (over === null) continue;
    out.set(fact.prd, over.state);
    if (over.send !== undefined) send.push({ prd: fact.prd, kind: over.send });
    retro ||= over.retro === true;
  }
  return { states: out, send, retro };
}

/** The dispatch of a plan job, signed `supervisor`. */
export function planDispatched(job: string, { prd, kind }: PlanSend): NewEvent {
  const n = `PRD ${String(prd)}`;
  const sentence = kind === 'plan'
    ? `Sent the PM ${planJobLine(prd, kind)}: ${n} has no plan on its page, so it is planned before its approval.`
    : `Sent the PM ${planJobLine(prd, kind)}: ${n}'s repairs are spent, so its slices not merged are planned again.`;
  return { kind: 'dispatched', role: 'supervisor', prd, job, link: null, sentence };
}

/** The end of a plan job, signed `pm`, once (none while it works, or once an event other than its dispatch names it). */
export function planEvents(one: PlanJob, recorded: readonly RecordedEvent[]): NewEvent[] {
  if (pmWorking(one) || recorded.some((event) => event.job === one.job && event.kind !== 'dispatched')) return [];
  const n = `PRD ${String(one.prd)}`;
  const how = one.attempt.status === 'done' ? null : one.attempt.status === 'cancelled' ? 'was cancelled' : 'failed';
  const sentence =
    how !== null
      ? `The PM's ${one.kind === 'plan' ? 'plan' : 'replan'} of ${n} ${how}.`
      : one.kind === 'plan'
        ? `The PM planned ${n}: its committee approves it once the plan is on its page, the PM sitting out.`
        : `The PM replanned ${n}'s slices not merged: the committee approves the new plan version, the PM sitting out.`;
  return [{ kind: 'job-ended', role: 'pm', prd: one.prd, job: one.job, link: null, sentence }];
}
