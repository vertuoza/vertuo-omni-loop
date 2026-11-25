// The PM's own product PRDs, planned, approved and reviewed before their build (PRD omni-loop-26, spec "Solution"): pure functions
// over what one run read. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   who it runs for  a product PRD the mission's PM wrote at `alone` (a `prd-added` event naming a product id), never a PRD a person
//                    wrote, which keeps its own approval. None of them goes to a committee
//   the order        the PM plans it (`/omni:mega-brainstorm --product <key> --plan-only <id>`, a PM job) and its job's `omni plan:`
//                    record is the `plan` decision, role pm; then the fleet's Architect reviews it (`/omni:tech-review <id> --mission
//                    <m>`, keyed `mission:<id>:prd:<id>:tech:<k>`) and its `omni tech:` record is the `tech` decision, role
//                    architect. A job that left no record that reads is recorded escalated (`no record of the tech review`,
//                    BL-GATE-1), never approved, and sent again (bug #3281): it decided nothing. At most FAILS such jobs of a
//                    kind in a row, then a person (bug #3286)
//   the version      both decisions name the plan's sha256: the build is sent only once a `plan` and a `tech` decision both approved
//                    the latest plan version on the PRD's page, which gives its approval in the fleet's name. A version the Architect
//                    pushed is approved by the PM again; a version pushed after the Architect's review is reviewed again. ROUNDS
//                    counts the plan approvals and the reviews that decided (a record naming a plan version), never a failure
//   open points      an Architect's review that escalated with open points sends the PM's plan job again (bug #3286): the PM reads
//                    them with `omni mission get`, answers each, rewording its own spec when it must, and approves the new version,
//                    which the Architect reviews again
//   escalated        a person gets the PRD once the Architect still escalates when the PM's rounds are spent, when the PM's own
//                    approval escalated, or when a kind's failures are spent, the decision's reasons (the Architect's open points
//                    first) in what it waits on, until a person approves it on its page
//   the events       each dispatch, signed `supervisor`; each decision recorded, signed by its role; all by `agent`
import { isProductPrdId, ProductPrdIdSchema, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { planOfLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import { unansweredOf } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { PmJob } from './pm.ts';
import type { MissionPrd } from './store.prd.ts';
import type { Approval, Attempt, EventRole } from './supervisor.ts';

/** The plan approvals and the reviews that decided a PM product PRD is sent at most: two rounds, then a person. */
const ROUNDS = 2;

/** The jobs of one kind that failed or left no record in a row a PM product PRD is sent at most, then a person (bug #3286). */
const FAILS = 2;

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
  | { state: 'plan'; again: boolean; points?: readonly string[]; unnamed?: true }
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

/** How many decisions of `kind` decided: each that names a plan version. */
const decidedOf = (mine: readonly PlanDecision[], kind: PlanDecision['kind']): number => mine.filter((one) => one.kind === kind && one.plan !== null).length;

/** How many jobs of `kind` in a row, the latest first, failed or left no record. */
function failsInRow(mine: readonly PlanDecision[], kind: PlanDecision['kind']): number {
  const ofKind = mine.filter((one) => one.kind === kind);
  const lastDecided = ofKind.findLastIndex((one) => one.plan !== null);
  return ofKind.length - 1 - lastDecided;
}

/** The PM's plan job: with the Architect's open points it has to answer, when there are some (bug #3286). */
function planWith(open: PlanDecision | null, again: boolean): ReviewState {
  return open === null ? { state: 'plan', again } : { state: 'plan', again: true, points: open.why };
}

/**
 * Where a PM product PRD whose last decision escalated is: built once a person approved it on its page; its job sent again when it
 * left no record (bug #3281), at most FAILS in a row, never counted approved (BL-GATE-1); the PM sent again with the Architect's open
 * points while its rounds last (bug #3286); else waiting on a person, the Architect's open points named first.
 */
function afterEscalated(view: ReviewView, mine: readonly PlanDecision[], last: PlanDecision): ReviewState {
  if (view.approval === 'standing') return { state: 'build' };
  const open = unansweredOf(mine);
  if (last.plan === null && failsInRow(mine, last.kind) < FAILS) return last.kind === 'plan' ? planWith(open, true) : { state: 'tech', k: view.techs.length + 1 };
  if (last.plan !== null && open !== null && decidedOf(mine, 'plan') < ROUNDS) return planWith(open, true);
  return { state: 'waits', why: escalatedWords(view.prd, open ?? last) };
}

/**
 * Where PM product PRD `view` is before its build (PRD omni-loop-26): `build` once a `plan` and a `tech` decision both approved its
 * latest plan version, or once a person approved it on its page after the fleet sent it to them; at work while a plan job or a review
 * works; else the next job (the PM's plan, again on a newer version or to answer the Architect's open points; the Architect's review),
 * or what it waits on. The rounds count the decisions that named a plan version (bug #3286).
 */
export function reviewStateOf(view: ReviewView): ReviewState {
  const mine = view.decisions.filter((one) => one.prd === view.prd);
  if (approvedOn(mine, 'plan', view.latest) && approvedOn(mine, 'tech', view.latest)) return { state: 'build' };
  if (view.plans.some((one) => working(one.attempt)) || view.techs.some((one) => working(one.attempt))) return { state: 'working' };
  const last = mine.at(-1);
  if (last?.outcome === 'escalated') return afterEscalated(view, mine, last);
  if (!approvedOn(mine, 'plan', view.latest)) return decidedOf(mine, 'plan') < ROUNDS ? { state: 'plan', again: view.plans.length > 0 } : { state: 'waits', why: spentWords(view.prd) };
  return decidedOf(mine, 'tech') < ROUNDS ? { state: 'tech', k: view.techs.length + 1 } : { state: 'waits', why: spentWords(view.prd) };
}

/**
 * Where a product PRD whose plan names no repository is once it would be built (bug #3304): never built without `--base-of`, whose
 * target pull requests would open into the default branch. A PRD the PM wrote (`view`) goes back to the PM's plan job, which writes
 * the plan's `## Repositories` table, while the PM's rounds last; at work while that job works; then, or for a PRD a person wrote
 * (`view` null), it waits on a person, saying why.
 */
export function unnamedStateOf(prd: ProductPrdId, view: ReviewView | null): Extract<ReviewState, { state: 'plan' | 'working' | 'waits' }> {
  if (view?.plans.some((one) => working(one.attempt)) === true) return { state: 'working' };
  const mine = view?.decisions.filter((one) => one.prd === prd) ?? [];
  if (view !== null && decidedOf(mine, 'plan') < ROUNDS) return { state: 'plan', again: true, unnamed: true };
  return { state: 'waits', why: `PRD ${prd}: its plan names no repository, so its build would open its pull requests into the default branch; write its ## Repositories table (owner/name) and approve it on its page` };
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

/** What the PM's plan job is sent for: a plan that names no repository (bug #3304), the Architect's open points, a newer plan version, or its first plan. */
function planSentence(prd: ProductPrdId, line: string, state: Extract<ReviewState, { state: 'plan' }>): string {
  if (state.unnamed === true) return `Sent the PM ${line} again: the plan of PRD ${prd} names no repository, so it writes its ## Repositories table before the build.`;
  if (state.points !== undefined) return `Sent the PM ${line} again: it answers the Architect's open points on PRD ${prd}.`;
  return state.again
    ? `Sent the PM ${line} again: PRD ${prd} has a newer plan version, so the PM approves it.`
    : `Sent the PM ${line}: it plans PRD ${prd}, which it wrote, and approves its plan.`;
}

/** The dispatch of a plan job or a review of PM product PRD `prd`, signed `supervisor`; `retry` when its last job left no record (bug #3281). */
export function reviewDispatched(prd: ProductPrdId, job: string, line: string, state: Extract<ReviewState, { state: 'plan' | 'tech' }>, retry = false): { kind: 'dispatched'; role: EventRole; prd: ProductPrdId; job: string; link: null; sentence: string } {
  const sentence = retry
    ? `Sent the ${state.state === 'tech' ? 'Architect' : 'PM'} ${line} again: its last job on PRD ${prd} failed or left no record.`
    : state.state === 'tech'
      ? `Sent the Architect ${line}: it reviews the plan of PRD ${prd} the PM approved${state.k > 1 ? ', its newer version' : ''}.`
      : planSentence(prd, line, state);
  return { kind: 'dispatched', role: 'supervisor', prd, job, link: null, sentence };
}
