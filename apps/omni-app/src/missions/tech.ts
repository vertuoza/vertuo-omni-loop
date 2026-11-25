// The PM's own product PRDs, planned, approved and reviewed before their build (PRD omni-loop-26, spec "Solution"): pure functions
// over what one run read. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   who it runs for  a product PRD the mission's PM wrote at `alone` (a `prd-added` event naming a product id), never a PRD a person
//                    wrote, which keeps its own approval. None of them goes to a committee
//   the order        the PM plans it (`/omni:mega-brainstorm --product <key> --plan-only <id>`, a PM job) and its job's `omni plan:`
//                    record is the `plan` decision, role pm; then the fleet's Architect reviews it (`/omni:tech-review <id> --mission
//                    <m>`, keyed `mission:<id>:prd:<id>:tech:<k>`) and its `omni tech:` record is the `tech` decision, role
//                    architect. A job that left no record that reads is recorded escalated (`no record of the tech review`,
//                    BL-GATE-1), never approved, and sent again while its rounds last (bug #3281): it decided nothing
//   the version      both decisions name the plan's sha256: the build is sent only once a `plan` and a `tech` decision both approved
//                    the latest plan version on the PRD's page, which gives its approval in the fleet's name. A version the Architect
//                    pushed is approved by the PM again; a version pushed after the Architect's review is reviewed again. Two plan
//                    jobs and two reviews at most (ROUNDS), then a person
//   escalated        a job that ran and escalated, or one with no record once its rounds are spent, leaves the PRD waiting on a
//                    person, the decision's reasons (the Architect's open points first) in what it waits on, until a person
//                    approves it on its page
//   the events       each dispatch, signed `supervisor`; each decision recorded, signed by its role; all by `agent`
import { isProductPrdId, ProductPrdIdSchema, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { planOfLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import type { PmJob } from './pm.ts';
import type { MissionPrd } from './store.prd.ts';
import type { Approval, Attempt, EventRole } from './supervisor.ts';

/** The plan jobs and the reviews a PM product PRD is sent at most: two rounds, then a person. */
const ROUNDS = 2;

/** A plan job the PM was sent for a product PRD: a PM job whose line plans that PRD. */
export type ProductPlanJob = PmJob & { prd: ProductPrdId };

/** The Architect's review of a product PRD the mission sent: its k-th, its job and its attempt. */
export type TechJob = { prd: ProductPrdId; k: number; job: string; attempt: Attempt };

/** A `plan` or `tech` decision as the store keeps it (`mission_decisions`), in the order it was recorded. */
export type PlanDecision = {
  kind: 'plan' | 'tech';
  prd: ProductPrdId;
  job: string;
  /** The plan version it names; null for an escalated one whose job left no record. */
  plan: string | null;
  outcome: 'approved' | 'escalated';
  why: string[];
  settled: string[];
};

/** What the run reads of one PM product PRD: its latest plan version on its page, its approval, its jobs and its decisions. */
export type ReviewView = {
  prd: ProductPrdId;
  /** The sha256 of the latest plan version on its page; null when it has none. */
  latest: string | null;
  approval: Approval;
  plans: readonly ProductPlanJob[];
  techs: readonly TechJob[];
  decisions: readonly PlanDecision[];
};

/** Where a PM product PRD is before its build: built as any product PRD, at work, a job to send, or waiting on a person. */
export type ReviewState =
  | { state: 'build' }
  | { state: 'working' }
  | { state: 'plan'; again: boolean }
  | { state: 'tech'; k: number }
  | { state: 'waits'; why: string };

const TECH_KEY = /^mission:[0-9a-f-]{36}:prd:([^:]+):tech:([1-9][0-9]*)$/;

/** The key of the Architect's k-th review of product PRD `prd` in mission `mission`. */
export const techKey = (mission: string, prd: ProductPrdId, k: number): string => `mission:${mission}:prd:${prd}:tech:${String(k)}`;

/** The product PRD and review a tech job's key names; null for any other key. */
export function techOfKey(key: string): { prd: ProductPrdId; k: number } | null {
  const match = TECH_KEY.exec(key);
  const prd = ProductPrdIdSchema.safeParse(match?.[1]);
  return match !== null && prd.success ? { prd: prd.data, k: Number(match[2]) } : null;
}

/** The PM's plan jobs of product PRDs among its jobs, each with the PRD its line names (a replan's never: a product PRD has none here). */
export function productPlansOf(jobs: readonly PmJob[]): ProductPlanJob[] {
  return jobs.flatMap((job) => {
    const planned = planOfLine(job.line);
    return planned === null || planned.kind !== 'plan' || !isProductPrdId(planned.prd) ? [] : [{ ...job, prd: planned.prd }];
  });
}

/** The product PRDs the mission's PM wrote, in the order its fleet added them: each `prd-added` event naming a product id, once. */
export function addedProductsOf(recorded: readonly { kind: string; product?: ProductPrdId; prd?: MissionPrd | null }[]): ProductPrdId[] {
  const added: ProductPrdId[] = [];
  for (const { kind, product, prd } of recorded) {
    const id = product ?? (typeof prd === 'string' ? prd : undefined);
    if (kind === 'prd-added' && id !== undefined && !added.includes(id)) added.push(id);
  }
  return added;
}

/** Whether a job is still to end. */
const working = ({ status }: Pick<Attempt, 'status'>): boolean => status === 'queued' || status === 'claimed' || status === 'running';

/** Whether `decisions` hold one of `kind` approved on plan version `latest`. */
const approvedOn = (decisions: readonly PlanDecision[], kind: PlanDecision['kind'], latest: string | null): boolean =>
  latest !== null && decisions.some((one) => one.kind === kind && one.outcome === 'approved' && one.plan === latest);

/** What an escalated decision leaves the PRD waiting on, its reasons in the order recorded. */
function escalatedWords(prd: ProductPrdId, decision: PlanDecision): string {
  const why = decision.why.length > 0 ? decision.why.join('; ') : 'it sent it to you';
  return decision.kind === 'tech'
    ? `PRD ${prd}: the Architect left it to you: ${why}; approve it on its page`
    : `PRD ${prd}: the PM's plan approval went to you: ${why}; approve it on its page`;
}

/** What a PRD whose rounds are spent waits on. */
const spentWords = (prd: ProductPrdId): string =>
  `PRD ${prd}: the PM and the Architect did not approve one plan version in ${String(ROUNDS)} rounds; approve it on its page`;

/**
 * Where a PM product PRD whose last decision escalated is: built once a person approved it on its page; its job sent again when it
 * left no record and its rounds last, since it decided nothing (bug #3281), never counted approved (BL-GATE-1); else waiting on a person.
 */
function afterEscalated(view: ReviewView, last: PlanDecision): ReviewState {
  if (view.approval === 'standing') return { state: 'build' };
  if (last.plan === null && last.kind === 'plan' && view.plans.length < ROUNDS) return { state: 'plan', again: true };
  if (last.plan === null && last.kind === 'tech' && view.techs.length < ROUNDS) return { state: 'tech', k: view.techs.length + 1 };
  return { state: 'waits', why: escalatedWords(view.prd, last) };
}

/**
 * Where PM product PRD `view` is before its build (PRD omni-loop-26): `build` once a `plan` and a `tech` decision both approved its
 * latest plan version, or once a person approved it on its page after the fleet sent it to them; at work while a plan job or a review
 * works; else the next job (the PM's plan, again on a newer version; the Architect's review), or what it waits on.
 */
export function reviewStateOf(view: ReviewView): ReviewState {
  const mine = view.decisions.filter((one) => one.prd === view.prd);
  if (approvedOn(mine, 'plan', view.latest) && approvedOn(mine, 'tech', view.latest)) return { state: 'build' };
  if (view.plans.some((one) => working(one.attempt)) || view.techs.some((one) => working(one.attempt))) return { state: 'working' };
  const last = mine.at(-1);
  if (last?.outcome === 'escalated') return afterEscalated(view, last);
  if (!approvedOn(mine, 'plan', view.latest)) return view.plans.length < ROUNDS ? { state: 'plan', again: view.plans.length > 0 } : { state: 'waits', why: spentWords(view.prd) };
  return view.techs.length < ROUNDS ? { state: 'tech', k: view.techs.length + 1 } : { state: 'waits', why: spentWords(view.prd) };
}

/** The first 7 characters of a plan version, as the events name it. */
const short = (plan: string | null): string => (plan === null ? 'no version' : `version ${plan.slice(0, 7)}`);

/** The event a recorded decision adds, signed by its role: the PM's plan approval, or the Architect's review. */
export function decisionEvent(decision: PlanDecision): { kind: 'job-ended'; role: EventRole; prd: ProductPrdId; job: string; link: null; sentence: string } {
  const n = `PRD ${decision.prd}`;
  const why = decision.why.join('; ');
  const settled = decision.settled.length > 0 ? `, settling: ${decision.settled.join('; ')}` : '';
  const sentence =
    decision.kind === 'plan'
      ? decision.outcome === 'approved'
        ? `The PM approved the plan of ${n} (${short(decision.plan)}).`
        : `The PM's plan approval of ${n} went to a person: ${why}.`
      : decision.outcome === 'approved'
        ? `The Architect approved the plan of ${n} (${short(decision.plan)})${settled}.`
        : `The Architect left ${n} to a person: ${why}.`;
  return { kind: 'job-ended', role: decision.kind === 'tech' ? 'architect' : 'pm', prd: decision.prd, job: decision.job, link: null, sentence };
}

/** Whether the last decision on PM product PRD `prd` is one whose job left no record: the job about to be sent is that one again. */
export const isRetry = (prd: ProductPrdId, decisions: readonly PlanDecision[]): boolean => {
  const last = decisions.filter((one) => one.prd === prd).at(-1);
  return last?.outcome === 'escalated' && last.plan === null;
};

/** The dispatch of a plan job or a review of PM product PRD `prd`, signed `supervisor`; `retry` when its last job left no record (bug #3281). */
export function reviewDispatched(prd: ProductPrdId, job: string, line: string, state: Extract<ReviewState, { state: 'plan' | 'tech' }>, retry = false): { kind: 'dispatched'; role: EventRole; prd: ProductPrdId; job: string; link: null; sentence: string } {
  const sentence = retry
    ? `Sent the ${state.state === 'tech' ? 'Architect' : 'PM'} ${line} again: its last job on PRD ${prd} failed or left no record.`
    : state.state === 'tech'
      ? `Sent the Architect ${line}: it reviews the plan of PRD ${prd} the PM approved${state.k > 1 ? ', its newer version' : ''}.`
      : state.again
        ? `Sent the PM ${line} again: PRD ${prd} has a newer plan version, so the PM approves it.`
        : `Sent the PM ${line}: it plans PRD ${prd}, which it wrote, and approves its plan.`;
  return { kind: 'dispatched', role: 'supervisor', prd, job, link: null, sentence };
}
