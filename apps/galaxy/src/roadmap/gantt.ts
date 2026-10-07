// A roadmap's Gantt (PRD 1162, "Roadmaps in Omni"), laid out pure from its PRD rows (store.ts' RoadmapPrdRow)
// and the clock, so the page only draws it:
//
// - one row per PRD, grouped by wave, each wave in the table's order;
// - one arrow per blocker that is a row, from the end of the blocker's bar to the start of the blocked one's;
// - once a PRD of the roadmap merged, bars on dates: a PRD that started is solid from its start (to its
//   end once merged or closed, else to now), then dashed to its start plus the median length of the
//   roadmap's merged PRDs; a PRD that has not started is dashed, from the latest end of its blockers
//   (or now) for that median. No estimate is ever made up: the median is this roadmap's own history.
// - before any merged, no dates at all: each bar sits in its wave's column;
// - in a plan repository (a row names its repositories), one lane per repository on each bar;
// - the pull request a PRD waits on, on its bar, while it is not merged.
//
// Every x is a fraction of the chart's width, 0 to 1; every row is its index top to bottom.
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { RoadmapPrdRow, RoadmapPrdState } from './store';

export type GanttPrd = Pick<RoadmapPrdRow, 'row_id' | 'prd' | 'title' | 'repos' | 'blockers' | 'wave' | 'state' | 'waits_on' | 'waits_on_url' | 'started_at' | 'ended_at'>;

/** A piece of a bar: `real` on dates that happened, `projected` dashed, `wave` a wave's column without dates. */
export interface GanttSegment {
  kind: 'real' | 'projected' | 'wave';
  from: number;
  to: number;
}

export interface GanttRow {
  id: string;
  prd: PrdNumber;
  title: string;
  href: string;
  wave: number;
  state: RoadmapPrdState;
  stateLabel: string;
  /** Its repositories, one lane each, in a plan repository; empty in one repository. */
  lanes: string[];
  blockers: string[];
  segments: GanttSegment[];
  /** The pull request it waits on, while it is not merged. */
  waitsOn: { label: string; url: string | null } | null;
  index: number;
}

export interface GanttArrow {
  from: string;
  to: string;
  fromRow: number;
  toRow: number;
  x1: number;
  x2: number;
}

export interface Gantt {
  /** On dates (a PRD merged), or in wave columns. */
  dated: boolean;
  /** The median length of the merged PRDs, in milliseconds, or null before any merged. */
  median: number | null;
  /** The axis: a column per wave, or a date at each mark. */
  columns: Array<{ label: string; at: number }>;
  groups: Array<{ wave: number; rows: GanttRow[] }>;
  rows: GanttRow[];
  arrows: GanttArrow[];
  /** The bars split into a lane per repository: a plan repository's roadmap. */
  lanes: boolean;
}

const STATE_LABELS: Readonly<Record<RoadmapPrdState, string>> = {
  waiting: 'waiting', building: 'building', outbox: 'outbox', ready: 'waiting for merge', merged: 'merged', closed: 'closed unmerged',
};

export const stateLabelOf = (state: RoadmapPrdState) => STATE_LABELS[state];

const DAY = 86_400_000;
const MARKS = 6;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A PRD's page in the app. */
export const prdHref = (prd: PrdNumber) => `/prd/${prd}`;

const timeOf = (iso: string | null): number | null => {
  if (iso === null) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : null;
};

const dateLabel = (at: number) => {
  const d = new Date(at);
  return `${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
};

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? hi) + hi) / 2;
}

const isEnded = (state: RoadmapPrdState) => state === 'merged' || state === 'closed';

/** The length of each merged PRD with both its dates. */
const mergedLengths = (prds: readonly GanttPrd[]) =>
  prds.flatMap((p) => {
    const [start, end] = [timeOf(p.started_at), timeOf(p.ended_at)];
    return p.state === 'merged' && start !== null && end !== null && end >= start ? [end - start] : [];
  });

type Span = { start: number; end: number; pieces: Array<{ kind: 'real' | 'projected'; from: number; to: number }> };

/** Each PRD's pieces on dates, in wave order so a blocker is placed before what it blocks. */
function spansOf(ordered: readonly GanttPrd[], length: number, now: number): Map<string, Span> {
  const spans = new Map<string, Span>();
  for (const p of ordered) {
    const started = timeOf(p.started_at) ?? (isEnded(p.state) ? timeOf(p.ended_at) : null);
    let span: Span;
    if (started === null) {
      const after = Math.max(now, ...p.blockers.map((b) => spans.get(b)?.end ?? now));
      span = { start: after, end: after + length, pieces: [{ kind: 'projected', from: after, to: after + length }] };
    } else if (isEnded(p.state)) {
      const end = Math.max(started, timeOf(p.ended_at) ?? now);
      span = { start: started, end, pieces: [{ kind: 'real', from: started, to: end }] };
    } else {
      const until = Math.max(started, now);
      const projected = started + length;
      const pieces: Span['pieces'] = [{ kind: 'real', from: started, to: until }];
      if (projected > until) pieces.push({ kind: 'projected', from: until, to: projected });
      span = { start: started, end: Math.max(until, projected), pieces };
    }
    spans.set(p.row_id, span);
  }
  return spans;
}

/** The axis's marks: its start, then evenly to its end, each a date. */
function marksOf(start: number, end: number): Gantt['columns'] {
  const days = Math.max(1, Math.round((end - start) / DAY));
  const count = Math.min(MARKS, days);
  return Array.from({ length: count }, (_, i) => {
    const at = start + ((end - start) * i) / count;
    return { label: dateLabel(at), at: (at - start) / (end - start) };
  });
}

export function ganttOf(prds: readonly GanttPrd[], now: number): Gantt {
  const waves = [...new Set(prds.map((p) => p.wave))].sort((a, b) => a - b);
  const ordered = waves.flatMap((wave) => prds.filter((p) => p.wave === wave));
  const lanes = prds.some((p) => p.repos.length > 0);
  const length = median(mergedLengths(prds));
  const ids = new Set(prds.map((p) => p.row_id));

  let segmentsOf: (p: GanttPrd) => GanttSegment[];
  let columns: Gantt['columns'];
  if (length === null) {
    const slot = (wave: number) => waves.indexOf(wave) / waves.length;
    segmentsOf = (p) => [{ kind: 'wave', from: slot(p.wave), to: (waves.indexOf(p.wave) + 1) / waves.length }];
    columns = waves.map((wave) => ({ label: `wave ${wave}`, at: slot(wave) }));
  } else {
    const spans = spansOf(ordered, length, now);
    const all = [...spans.values()];
    const start = Math.min(...all.map((s) => s.start));
    const end = Math.max(start + DAY, ...all.map((s) => s.end));
    const x = (at: number) => (at - start) / (end - start);
    segmentsOf = (p) => (spans.get(p.row_id)?.pieces ?? []).map((piece) => ({ kind: piece.kind, from: x(piece.from), to: x(piece.to) }));
    columns = marksOf(start, end);
  }

  const rows = ordered.map((p, index): GanttRow => ({
    id: p.row_id,
    prd: p.prd,
    title: p.title,
    href: prdHref(p.prd),
    wave: p.wave,
    state: p.state,
    stateLabel: stateLabelOf(p.state),
    lanes: lanes ? [...p.repos] : [],
    blockers: [...p.blockers],
    segments: segmentsOf(p),
    waitsOn: p.state !== 'merged' && p.waits_on !== null ? { label: p.waits_on, url: p.waits_on_url } : null,
    index,
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const arrows = rows.flatMap((row) =>
    row.blockers.filter((b) => ids.has(b)).flatMap((b): GanttArrow[] => {
      const blocker = byId.get(b);
      if (!blocker) return [];
      return [{ from: b, to: row.id, fromRow: blocker.index, toRow: row.index, x1: blocker.segments.at(-1)?.to ?? 0, x2: row.segments[0]?.from ?? 0 }];
    }));
  // Arrows in the order of their blocked row, then their blocker's.
  arrows.sort((a, b) => a.toRow - b.toRow || a.fromRow - b.fromRow);

  return {
    dated: length !== null,
    median: length,
    columns,
    groups: waves.map((wave) => ({ wave, rows: rows.filter((r) => r.wave === wave) })),
    rows,
    arrows,
    lanes,
  };
}
