// A PRD's timeline (PRD 2370): a pure function of its recorded milestones, never of a live GitHub read.
// The gaps are computed, never stored. A gap whose start is recorded and whose end is not yet is
// running, counted up to `now`; a gap missing its start is not recorded, never zero and never guessed.
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MilestoneId } from './store';

/** The milestones in the order a PRD reaches them. */
const MILESTONES: readonly MilestoneId[] =
  ['idea', 'plan', 'approved', 'opened', 'first-slice', 'last-slice', 'ready', 'merged'];

export type GapId = 'writing' | 'approval' | 'starting' | 'building' | 'finishing' | 'review';

/** The gaps in order: the first two once per PRD, the other four once per lane. */
export const GAPS: readonly GapId[] = ['writing', 'approval', 'starting', 'building', 'finishing', 'review'];

const GAP_LABELS: Readonly<Record<GapId, string>> = {
  writing: 'Writing it', approval: 'Approval', starting: 'Starting', building: 'Building',
  finishing: 'Finishing', review: 'Review',
};

/** Who a gap waits on: a role, never a login. */
export const GAP_WAITS_ON: Readonly<Record<GapId, string>> = {
  writing: 'PM + brainstorm', approval: 'approver', starting: 'agents', building: 'agents',
  finishing: 'agents + outbox', review: 'reviewer',
};

/** One recorded milestone, as the store holds it: `lane` is a repository, `pr` null for the PRD's own. */
export type Milestone = { lane: string; milestone: MilestoneId; reachedAt: string; pr: PrNumber | null };

export type GapState = 'done' | 'running' | 'not-recorded';

export type Gap = {
  id: GapId;
  label: string;
  waitsOn: string;
  /** The lane of a lane gap; null for a PRD-level gap. */
  lane: string | null;
  /** The milestone the gap starts from, as recorded (null: none recorded). */
  from: MilestoneId | null;
  /** The milestone it ends at; null while running or not recorded. */
  to: MilestoneId | null;
  /** The two times as ISO strings; `end` is null while running or not recorded. */
  start: string | null;
  end: string | null;
  /** The duration in ms, counted to `now` while running; null when not recorded. */
  ms: number | null;
  state: GapState;
};

export type LaneTimeline = { lane: string; gaps: Gap[] };

export type Timeline = {
  /** `writing` and `approval`, once per PRD. */
  gaps: Gap[];
  /** The four lane gaps, per lane, lanes in name order. */
  lanes: LaneTimeline[];
  /** First recorded milestone to the last lane's merge, or to `now` while running; null with no milestone. */
  total: { ms: number; running: boolean } | null;
  /** The gap with the largest duration, a running one included; null when none has one. */
  longest: Gap | null;
  /** The running gap that started last: where the PRD is now; null when none runs. */
  now: Gap | null;
};

type Reached = ReadonlyMap<MilestoneId, { at: number; iso: string }>;

const order = (id: MilestoneId): number => MILESTONES.indexOf(id);
const isLaneLevel = (m: Milestone): boolean => order(m.milestone) >= order('opened');

/** The recorded time of each milestone, by the store's rules: first wins, `last-slice` moves later only. */
function reachedOf(rows: readonly Milestone[]): Reached {
  const reached = new Map<MilestoneId, { at: number; iso: string }>();
  for (const row of rows) {
    const at = Date.parse(row.reachedAt);
    if (Number.isNaN(at)) continue;
    const known = reached.get(row.milestone);
    const later = row.milestone === 'last-slice';
    if (known === undefined || (later ? at > known.at : at < known.at)) reached.set(row.milestone, { at, iso: row.reachedAt });
  }
  return reached;
}

const SPEC: Readonly<Record<GapId, { from: readonly MilestoneId[]; to: MilestoneId }>> = {
  writing: { from: ['idea'], to: 'plan' },
  approval: { from: ['plan'], to: 'approved' },
  starting: { from: ['approved', 'opened'], to: 'first-slice' },
  building: { from: ['first-slice'], to: 'last-slice' },
  finishing: { from: ['last-slice'], to: 'ready' },
  review: { from: ['ready'], to: 'merged' },
};

type Start = { m: MilestoneId; at: number; iso: string };

/** The later of the recorded starting milestones of a gap, or null when none is recorded. */
function startOf(from: readonly MilestoneId[], reached: Reached): Start | null {
  const hits = from.flatMap((m) => {
    const hit = reached.get(m);
    return hit === undefined ? [] : [{ m, ...hit }];
  });
  return hits.reduce<Start | null>((best, s) => (best === null || s.at > best.at ? s : best), null);
}

function gapOf(id: GapId, lane: string | null, reached: Reached, now: number): Gap {
  const spec = SPEC[id];
  const start = startOf(spec.from, reached);
  const end = reached.get(spec.to) ?? null;
  const base = { id, label: GAP_LABELS[id], waitsOn: GAP_WAITS_ON[id], lane, from: start?.m ?? null };
  const none = { ...base, to: null, start: start?.iso ?? null, end: null, ms: null, state: 'not-recorded' } as const;
  if (start === null) return none;
  // A rework slice merged after `ready` would end Finishing before it began: it never runs backwards.
  if (end !== null) return { ...base, to: spec.to, start: start.iso, end: end.iso, ms: Math.max(0, end.at - start.at), state: 'done' };
  // Something later is recorded, so the end was passed without a date: not running, not recorded.
  if ([...reached.keys()].some((m) => order(m) > order(spec.to))) return none;
  return { ...base, to: null, start: start.iso, end: null, ms: Math.max(0, now - start.at), state: 'running' };
}

const LANE_GAPS = ['starting', 'building', 'finishing', 'review'] as const;

/** First recorded milestone to the last lane's merge, or to `now` while a lane has not merged. */
function totalOf(all: Reached, lanes: readonly LaneTimeline[], now: number): Timeline['total'] {
  const times = [...all.values()].map((r) => r.at);
  if (times.length === 0) return null;
  const merges = lanes.map((l) => Date.parse(l.gaps[3]?.end ?? ''));
  const done = merges.length > 0 && merges.every((m) => !Number.isNaN(m));
  return { ms: Math.max(0, (done ? Math.max(...merges) : now) - Math.min(...times)), running: !done };
}

/** The gap with the largest duration, and the running gap that started last. */
function pickOf(every: readonly Gap[]): { longest: Gap | null; current: Gap | null } {
  const longest = every.reduce<Gap | null>((best, g) => (g.ms !== null && (best === null || g.ms > (best.ms ?? 0)) ? g : best), null);
  const started = (g: Gap): number => Date.parse(g.start ?? '');
  const current = every.filter((g) => g.state === 'running')
    .reduce<Gap | null>((best, g) => (best === null || started(g) > started(best) ? g : best), null);
  return { longest, current };
}

/** A PRD's gaps, total, longest wait and where it is now, from its recorded milestones and `now`. */
export function timeline(milestones: readonly Milestone[], now: Date | number): Timeline {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const all = reachedOf(milestones);
  const prdLevel = reachedOf(milestones.filter((m) => !isLaneLevel(m)));
  const laneNames = [...new Set(milestones.filter(isLaneLevel).map((m) => m.lane))].sort();

  const gaps = [gapOf('writing', null, all, nowMs), gapOf('approval', null, all, nowMs)];
  const lanes = laneNames.map((lane) => {
    const own = reachedOf(milestones.filter((m) => m.lane === lane && isLaneLevel(m)));
    const scope = new Map([...prdLevel, ...own]);
    return { lane, gaps: LANE_GAPS.map((id) => gapOf(id, lane, scope, nowMs)) };
  });
  const every = [...gaps, ...lanes.flatMap((l) => l.gaps)];

  const { longest, current } = pickOf(every);
  return { gaps, lanes, total: totalOf(all, lanes, nowMs), longest, now: current };
}
