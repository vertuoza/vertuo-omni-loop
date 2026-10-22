import { median } from './median';
import { GAPS, GAP_WAITS_ON, timeline, type Gap, type GapId, type Milestone, type Timeline } from '../timeline/timeline';
import type { WorkspaceMilestone } from '../timeline/store';

// The Engineering board's Time per step panel (PRD 2370 s6), pure. A PRD is done in the period when
// every one of its lanes has merged and the last merge falls in the window [from, to). For each gap
// of the PRD's timeline the panel takes the median over those PRDs (one value per lane for a lane gap),
// counts the values it covers, and names the slowest step: the gap with the largest median. A gap
// nobody dated has no value: its median is null and it covers none, never zero.

export interface StepRow {
  id: GapId;
  label: string;
  waitsOn: string;
  /** In milliseconds; null when no done PRD dated the gap. */
  median: number | null;
  /** How many values the median is over. */
  covers: number;
}

export interface TimePerStep {
  /** The PRDs done in the period. */
  done: number;
  /** The six gaps in order; empty with no PRD done. */
  steps: StepRow[];
  /** The step with the largest median; null when none has one. */
  slowest: { label: string; median: number } | null;
}

const NONE: TimePerStep = { done: 0, steps: [], slowest: null };

/** When a PRD was done: its last lane's merge; null while any lane has not merged, or with no lane. */
function doneAt(lanes: readonly { gaps: readonly Gap[] }[]): number | null {
  const merges = lanes.map((l) => Date.parse(l.gaps.find((g) => g.id === 'review')?.end ?? ''));
  return merges.length === 0 || merges.some(Number.isNaN) ? null : Math.max(...merges);
}

type Values = Map<GapId, { label: string; ms: number[] }>;

/** The PRDs' milestones of the tracked repositories, grouped by PRD. */
function groupByPrd(milestones: readonly WorkspaceMilestone[], tracked: ReadonlySet<string>): Milestone[][] {
  const byPrd = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const repository = m.repository.toLowerCase();
    if (!tracked.has(repository)) continue;
    const key = `${repository}#${m.prd}`;
    byPrd.set(key, [...(byPrd.get(key) ?? []), { lane: m.lane, milestone: m.milestone, reachedAt: m.reached_at, pr: m.pr }]);
  }
  return [...byPrd.values()];
}

/** Adds each dated gap of a PRD's timeline to the values of its step. */
function collect(values: Values, t: Timeline): void {
  for (const gap of [...t.gaps, ...t.lanes.flatMap((l) => l.gaps)]) {
    const entry = values.get(gap.id) ?? { label: gap.label, ms: [] };
    if (gap.state === 'done' && gap.ms !== null) entry.ms.push(gap.ms);
    values.set(gap.id, entry);
  }
}

/** The step with the largest median, null when none has one. */
function slowestOf(steps: readonly StepRow[]): TimePerStep['slowest'] {
  let slowest: TimePerStep['slowest'] = null;
  for (const s of steps) if (s.median !== null && (slowest === null || s.median > slowest.median)) slowest = { label: s.label, median: s.median };
  return slowest;
}

/** The panel over the workspace's milestones of the tracked repositories, for the window [from, to). */
export function timePerStepOf(
  milestones: readonly WorkspaceMilestone[], tracked: ReadonlySet<string>, from: number, to: number, now: Date,
): TimePerStep {
  const values: Values = new Map();
  let done = 0;
  for (const rows of groupByPrd(milestones, tracked)) {
    const t = timeline(rows, now);
    const at = doneAt(t.lanes);
    if (at === null || at < from || at >= to) continue;
    done++;
    collect(values, t);
  }
  if (done === 0) return NONE;
  const steps = GAPS.flatMap((id): StepRow[] => {
    const entry = values.get(id);
    return entry ? [{ id, label: entry.label, waitsOn: GAP_WAITS_ON[id], median: median(entry.ms), covers: entry.ms.length }] : [];
  });
  return { done, steps, slowest: slowestOf(steps) };
}
