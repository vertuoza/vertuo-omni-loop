// The engine's motion primitives (PRD 1108 s4): cubic-bezier easings, damped springs and `interpolate`.
// Each is a pure function of its input — the frame number, never the clock — so a frame renders the
// same pixels however often, and in whatever order, it is asked for.
//
// The approach (a frame-driven runtime of easings and springs sampled per frame, its springs integrated
// once and cached) follows vertuoza/release-videos' engine; the code is written afresh for the kit.

export type Easing = (t: number) => number;

const NEWTON_STEPS = 8;
const BISECTION_STEPS = 30;
const EPSILON = 1e-6;

type Curve = { x: (t: number) => number; y: (t: number) => number; dx: (t: number) => number };

/** The polynomial of one axis of a cubic bezier from (0,0) to (1,1) through `p1` and `p2`. */
function axis(p1: number, p2: number): { at: (t: number) => number; slope: (t: number) => number } {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return { at: (t) => ((a * t + b) * t + c) * t, slope: (t) => (3 * a * t + 2 * b) * t + c };
}

/** The curve's parameter at `x`: Newton's method, then bisection when the slope is too flat for it. */
function solve(curve: Curve, x: number): number {
  let t = x;
  for (let step = 0; step < NEWTON_STEPS; step += 1) {
    const error = curve.x(t) - x;
    if (Math.abs(error) < EPSILON) return t;
    const slope = curve.dx(t);
    if (Math.abs(slope) < EPSILON) break;
    t -= error / slope;
  }
  let low = 0;
  let high = 1;
  t = x;
  for (let step = 0; step < BISECTION_STEPS && Math.abs(curve.x(t) - x) >= EPSILON; step += 1) {
    if (curve.x(t) < x) low = t;
    else high = t;
    t = (low + high) / 2;
  }
  return t;
}

/** A CSS `cubic-bezier(x1, y1, x2, y2)` easing: 0 at or before 0, 1 at or after 1. */
export function bezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const horizontal = axis(x1, x2);
  const vertical = axis(y1, y2);
  const curve: Curve = { x: horizontal.at, y: vertical.at, dx: horizontal.slope };
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return curve.y(solve(curve, x));
  };
}

/** The engine's curves: `out` is the house curve, fast out with a long soft landing. */
export const EASINGS = Object.freeze({
  linear: (t: number): number => t,
  out: bezier(0.16, 1, 0.3, 1),
  inOut: bezier(0.65, 0, 0.35, 1),
  in: bezier(0.55, 0, 1, 0.45),
});

export const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));
export const mix = (from: number, to: number, t: number): number => from + (to - from) * t;

/** The segment of `input` that holds `value`: the last one when `value` is past them all. */
function segmentOf(value: number, input: readonly number[]): number {
  let index = 1;
  while (index < input.length - 1 && value > (input[index] ?? value)) index += 1;
  return index;
}

/**
 * `value` mapped from the stops of `input` onto those of `output`, eased inside each segment. Clamped to
 * the first and last stop unless `extend` is set, when it carries on in a straight line.
 */
export function interpolate(value: number, input: readonly number[], output: readonly number[], options: { easing?: Easing; extend?: boolean } = {}): number {
  if (input.length !== output.length || input.length < 2) throw new Error('interpolate: the ranges must match and hold two stops or more');
  const index = segmentOf(value, input);
  const [from, to] = [input[index - 1] ?? 0, input[index] ?? 0];
  const [low, high] = [output[index - 1] ?? 0, output[index] ?? 0];
  const raw = to === from ? 1 : (value - from) / (to - from);
  const t = options.extend === true ? raw : clamp(raw);
  const eased = t >= 0 && t <= 1 ? (options.easing ?? EASINGS.linear)(t) : t;
  return mix(low, high, eased);
}

export type SpringConfig = Readonly<{ stiffness: number; damping: number; mass: number }>;

/** `smooth` for text (no visible overshoot), `snappy` for small things, `bouncy` for a little life, `heavy` for big shapes. */
export const SPRINGS = Object.freeze({
  smooth: { stiffness: 110, damping: 21, mass: 1 },
  snappy: { stiffness: 220, damping: 26, mass: 1 },
  bouncy: { stiffness: 160, damping: 13, mass: 1 },
  heavy: { stiffness: 60, damping: 17, mass: 1.4 },
} satisfies Record<string, SpringConfig>);

const SUBSTEPS = 8;

/** One spring's positions frame by frame, integrated as far as asked, and its velocity there. */
type SpringTable = { positions: number[]; velocity: number };
const tables = new Map<string, SpringTable>();

/** Integrates `table` forward (semi-implicit Euler, a few steps per frame) until it holds frame `last`. */
function extend(table: SpringTable, last: number, fps: number, config: SpringConfig): void {
  const dt = 1 / fps / SUBSTEPS;
  let position = table.positions.at(-1) ?? 0;
  let velocity = table.velocity;
  while (table.positions.length <= last) {
    for (let step = 0; step < SUBSTEPS; step += 1) {
      const acceleration = (-config.stiffness * (position - 1) - config.damping * velocity) / config.mass;
      velocity += acceleration * dt;
      position += velocity * dt;
    }
    table.positions.push(position);
  }
  table.velocity = velocity;
}

/** A damped spring from 0 to 1, `frame` frames after it starts: 0 at or before its start. */
export function spring(frame: number, fps: number, config: SpringConfig = SPRINGS.smooth): number {
  if (frame <= 0) return 0;
  const key = `${fps}|${config.stiffness}|${config.damping}|${config.mass}`;
  const table = tables.get(key) ?? { positions: [0], velocity: 0 };
  tables.set(key, table);
  const low = Math.floor(frame);
  extend(table, low + 1, fps, config);
  const at = (n: number): number => table.positions[n] ?? 1;
  return mix(at(low), at(low + 1), frame - low);
}
