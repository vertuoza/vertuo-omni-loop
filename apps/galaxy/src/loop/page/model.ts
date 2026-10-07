// What the Loop page shows (PRD 1139 s5), built from the stored rows (store.ts) and the clock, pure:
// the workspace's loops, each with who runs it, its repository, its state and its last tick; and one
// loop opened, with every version of its plan as a timeline per PRD, its ledger and its parked PRDs.
// The page decides the situation (closed, signed out, in no workspace) before any of this.
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { peopleOf, type RosterRow } from '../../people/load';
import type { Person } from '../../people/types';
import type { LoopState } from '../state';
import type { LoopRow, PlanRow, TickRow } from './rows';
import { clockOf, ledgerOf, prdHref, readPlan, stateLineOf, timelineOf, type LedgerLine, type ReadPlan, type TimelineRow } from './view';

/** Where the Loop page lives, and one loop's page under it. */
export const LOOP_PATH = '/app/loop';
export const loopHref = (id: string) => `${LOOP_PATH}/${encodeURIComponent(id)}`;

/** A loop as the list shows it. */
export interface LoopSummary {
  id: string;
  href: string;
  who: Person;
  repo: string;
  state: LoopState;
  stateLine: string;
  /** Its last tick, `14:21 UTC`, or null before its first. */
  lastTick: string | null;
  prds: PrdNumber[];
  /** How many of its PRDs wait on a person. */
  waiting: number;
}

/** One version of a loop's plan. */
export interface PlanVersion {
  version: number;
  reason: string;
  at: string;
  plan: ReadPlan;
  steps: number;
  rows: TimelineRow[];
}

/** A PRD the loop parked on a person. */
export interface ParkedLine {
  prd: PrdNumber;
  href: string;
  who: string;
  what: string;
  /** Where the person acts, or null. */
  link: string | null;
  at: string;
}

/** One loop opened. */
export interface LoopDetail extends LoopSummary {
  /** Every version of its plan, the latest first. */
  versions: PlanVersion[];
  /** The step its last tick took, of how many, or null before its first tick. */
  current: { step: number; steps: number } | null;
  ledger: LedgerLine[];
  parked: ParkedLine[];
}

export type LoopPageView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  /** The workspace could not be read. */
  | { kind: 'unreadable' }
  | { kind: 'list'; name: string; loops: LoopSummary[] }
  | { kind: 'loop'; name: string; loop: LoopDetail };

/** Who runs each loop: the workspace's roster, by account id. */
export interface Runners {
  of(userId: string): Person;
}

/** The roster as Runners: a member by their name, else their login; anyone else as "A member". */
export function runnersOf(roster: readonly RosterRow[]): Runners {
  const people = peopleOf(roster, []);
  const names = new Map(roster.map((r) => [r.user_id, r.name ?? r.github_login ?? 'A member']));
  return { of: (userId) => people.byId(userId, names.get(userId) ?? 'A member') };
}

export function summaryOf(row: LoopRow, runners: Runners, now: number): LoopSummary {
  const { state, line } = stateLineOf(row, now);
  return {
    id: row.id,
    href: loopHref(row.id),
    who: runners.of(row.user_id),
    repo: row.repo,
    state,
    stateLine: line,
    lastTick: row.last_tick_at ? clockOf(row.last_tick_at) : null,
    prds: row.prds,
    waiting: row.parked.length,
  };
}

export function detailOf(row: LoopRow, ticks: readonly TickRow[], plans: readonly PlanRow[], runners: Runners, now: number): LoopDetail {
  const last = ticks.at(-1);
  const current = last ? { step: last.step, steps: last.steps } : null;
  const versions = [...plans].sort((a, b) => b.version - a.version).map((p, i): PlanVersion => {
    const plan = readPlan(p.plan);
    const steps = plan.kind === 'steps' ? plan.steps : [];
    // Only the latest version is followed: an earlier one shows its steps, none of them done.
    return { version: p.version, reason: p.reason, at: clockOf(p.created_at), plan, steps: steps.length, rows: timelineOf(steps, i === 0 ? current?.step ?? null : null) };
  });
  return {
    ...summaryOf(row, runners, now),
    versions,
    current,
    ledger: ledgerOf(ticks, plans),
    parked: row.parked.map((p) => ({ prd: p.prd, href: prdHref(p.prd), who: p.who, what: p.what, link: p.link, at: clockOf(p.at) })),
  };
}
