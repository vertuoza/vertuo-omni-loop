import type { ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { roleOf } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { timeOf } from './room';

// The plan and tech rows of the Operation room (PRD omni-loop-26 s5, the `fleet-room` screen), pure so each is tested without a
// browser. A product PRD the mission's PM wrote is planned and approved by the PM (a `plan` decision, naming its plan version) and
// reviewed by the fleet's Architect (a `tech` decision, naming what it settled by changing the plan and what it left to a person).
// One line per PRD and mission: the PM's newest plan decision, the Architect's newest review, and, while that review is escalated,
// its open points, which the room lists under Waiting on you. Every row is a recorded decision, signed by its role as an agent.

export const REVIEW_WORDS = {
  reviews: 'Plans and reviews',
  waitingOnYou: 'Waiting on you',
  notReviewed: 'Not reviewed yet',
  approved: 'Approved',
  sentToYou: 'Sent to you',
  waiting: 'Waiting',
} as const;

/** A `plan` or `tech` decision as the repository read it (`mission_decisions`). */
export interface PlanDecisionRow {
  mission: string;
  /** The product PRD's id, `omni-loop-31`. */
  prd: ProductPrdId;
  kind: 'plan' | 'tech';
  outcome: 'approved' | 'escalated';
  /** The sha256 of the plan version it names; null for an escalated one whose job left no record. */
  plan: string | null;
  settled: readonly string[];
  why: readonly string[];
  at: string;
}

/** One row of a PRD's line: who decided, when (null when nothing was decided yet), what, and its state word. */
export interface ReviewRow {
  by: string;
  time: string | null;
  words: string;
  state: string;
}

/** One PRD of the PM's: its plan row, its tech row, and the Architect's open points while its newest review is escalated. */
export interface ReviewLine {
  mission: string;
  prd: ProductPrdId;
  plan: ReviewRow;
  tech: ReviewRow;
  open: readonly string[];
}

/** One open point under Waiting on you. */
export interface WaitingPoint {
  id: string;
  prd: ProductPrdId;
  by: string;
  point: string;
}

const PM = `${roleOf('pm').name} · agent`;
const ARCHITECT = `${roleOf('architect').name} · agent`;

const version = (plan: string | null): string => (plan === null ? 'no version' : `version ${plan.slice(0, 7)}`);
const settledWords = (settled: readonly string[]): string => (settled.length === 0 ? '' : ` · settled: ${settled.join('; ')}`);
const points = (n: number): string => `${String(n)} ${n === 1 ? 'point' : 'points'}`;

/** The PM's row: its newest plan decision, approved on a version or sent to a person. */
function planRow(decision: PlanDecisionRow): ReviewRow {
  if (decision.outcome === 'approved') return { by: PM, time: timeOf(decision.at), words: `Approved the plan · ${version(decision.plan)}`, state: REVIEW_WORDS.approved };
  return { by: PM, time: timeOf(decision.at), words: `Sent the plan to you: ${decision.why.join('; ')}`, state: REVIEW_WORDS.sentToYou };
}

/** The Architect's row: its newest review, what it settled, and how many points it left to a person; or that none was made yet. */
function techRow(decision: PlanDecisionRow | undefined): ReviewRow {
  if (decision === undefined) return { by: ARCHITECT, time: null, words: REVIEW_WORDS.notReviewed, state: REVIEW_WORDS.waiting };
  const settled = decision.settled.length === 0 && decision.outcome === 'approved' ? ' · nothing to settle' : settledWords(decision.settled);
  if (decision.outcome === 'approved') return { by: ARCHITECT, time: timeOf(decision.at), words: `Approved ${version(decision.plan)}${settled}`, state: REVIEW_WORDS.approved };
  return { by: ARCHITECT, time: timeOf(decision.at), words: `Left ${points(decision.why.length)} to you${settled}`, state: REVIEW_WORDS.sentToYou };
}

/**
 * One line per product PRD and mission with a plan or tech decision, in the order each was first decided; only `mission`'s when one
 * is named. A line shows a PRD's newest decision of each kind, so a newer plan version reads beside the review of an older one.
 */
export function reviewLinesOf(decisions: readonly PlanDecisionRow[], mission: string | null = null): ReviewLine[] {
  const byPrd = new Map<string, PlanDecisionRow[]>();
  for (const one of decisions.toSorted((a, b) => a.at.localeCompare(b.at))) {
    if (mission !== null && one.mission !== mission) continue;
    const key = `${one.mission}:${one.prd}`;
    byPrd.set(key, [...(byPrd.get(key) ?? []), one]);
  }
  return [...byPrd.values()].flatMap((rows) => {
    const first = rows[0];
    const plan = rows.findLast((one) => one.kind === 'plan');
    const tech = rows.findLast((one) => one.kind === 'tech');
    if (first === undefined || plan === undefined) return [];
    return [{ mission: first.mission, prd: first.prd, plan: planRow(plan), tech: techRow(tech), open: tech?.outcome === 'escalated' ? tech.why : [] }];
  });
}

/** The Architect's open points, one per line, under the PRD they hold. */
export function waitingOf(lines: readonly ReviewLine[]): WaitingPoint[] {
  return lines.flatMap((line) => line.open.map((point, i) => ({ id: `${line.mission}:${line.prd}:${String(i)}`, prd: line.prd, by: ARCHITECT, point })));
}
