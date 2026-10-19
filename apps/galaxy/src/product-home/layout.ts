// The Constellation's layout (PRD 2174 s2): where each star sits, a seeded force layout computed on the
// server. Pure: the same rows and the same seed always give the same map; no randomness outside the seed,
// no time.
//
// - The stars are taken in name order, so the rows' order changes nothing. They start on a spiral (the
//   golden angle, radius `40 + 54 × √i`, flattened to 0.7 vertically), turned by an angle the seed (the
//   product's id) picks.
// - Then 300 steps: every pair of stars repels (`26000 / d²`), every line pulls its two ends together
//   (`0.004 × min(weight, 6) × (d − 150)`), a weak pull holds all toward the centre (`0.004` across, `0.008`
//   down), and two label boxes that overlap push apart. A step moves a star at most `30 × (1 − step / 300) +
//   2` px, and keeps its box 8 px inside the sky.
// - Then a separation pass that only separates: each pair of overlapping boxes moves apart by its whole
//   overlap along the shorter axis, every box kept 8 px inside, until none overlaps (at most 400 rounds).
//
// A star's label box is its name at 13 px mono, measured as 7.8 px a character (28 at most: a longer name
// is cut on the sky), plus its star, 66 px tall from 24 px above the star's centre. The role prints under
// the name, so a role longer than the name is measured instead. The star sits inside its own box, so no
// two boxes overlapping means no box covers another's star.

/** The sky's width, in the SVG's own units. */
export const SKY_WIDTH = 960;

export interface Point {
  x: number;
  y: number;
}

/** A label box: its top-left corner and its size. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A star as the layout reads it: its repository (`owner/name`) and its role, when it has one. */
export interface LayoutStar {
  repository: string;
  role: string | null;
}

/** A line between two stars, by repository, and how many PRDs share it. */
export interface LayoutLine {
  a: string;
  b: string;
  weight: number;
}

/** Where each star sits and its label box, by repository, and the sky's size. */
export interface Layout {
  width: number;
  height: number;
  at: ReadonlyMap<string, Point>;
  boxes: ReadonlyMap<string, Box>;
}

const CHAR = 7.8;
const MAX_CHARS = 28;
/** The star's own width in its box: the 44 px it takes to tap. */
const STAR = 44;
const BOX_HEIGHT = 66;
/** How far above the star's centre its box starts. */
const BOX_ABOVE = 24;
/** How far inside the sky every box stays. */
const MARGIN = 8;
/** The room the separation pass leaves between two boxes, so rounding never makes them touch. */
const GAP = 2;

const STEPS = 300;
const REPULSION = 26000;
const PULL = 0.004;
const MAX_WEIGHT = 6;
const REST = 150;
const CENTRE_X = 0.004;
const CENTRE_Y = 0.008;
/** How hard two overlapping boxes push apart during the force steps, as a share of their overlap. */
const BOX_PUSH = 0.5;
const GOLDEN = 2.4;
const FLATTEN = 0.7;
const ROUNDS = 400;

/** The sky's height for `n` stars: `max(500, 120 × ceil(n / 4))`. */
export const skyHeightOf = (n: number): number => Math.max(500, 120 * Math.ceil(n / 4));

const shortName = (repository: string) => repository.split('/').at(-1) ?? repository;

/** How wide a star's box is: its longer line (the name, or the role), 28 characters at most, plus its star. */
function widthOf(star: LayoutStar): number {
  const chars = Math.max(shortName(star.repository).length, star.role?.length ?? 0);
  return Math.min(chars, MAX_CHARS) * CHAR + STAR;
}

/** The label box of `star` when it sits at `at`. */
export function labelBoxOf(star: LayoutStar, at: Point): Box {
  const width = widthOf(star);
  return { x: at.x - width / 2, y: at.y - BOX_ABOVE, width, height: BOX_HEIGHT };
}

/** A number in [0, 1) from a string (FNV-1a), the same for the same string. */
function unitOf(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** A star while it moves: where it is, the force on it this step, and its box's width. */
interface Body {
  star: LayoutStar;
  repository: string;
  width: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
}

/** A line between two bodies, and how hard it pulls. */
interface Spring {
  p: Body;
  q: Body;
  pull: number;
}

/** Every pair of `bodies` once, in order. */
const pairsOf = (bodies: readonly Body[]): [Body, Body][] =>
  bodies.flatMap((p, i) => bodies.slice(i + 1).map((q): [Body, Body] => [p, q]));

/** How far two bodies' boxes overlap across and down (each positive when they do), `gap` counted as overlap. */
function overlapOf(p: Body, q: Body, gap: number): { across: number; down: number } {
  return { across: (p.width + q.width) / 2 + gap - Math.abs(p.x - q.x), down: BOX_HEIGHT + gap - Math.abs(p.y - q.y) };
}

/** Which way `q` lies from `p` along one axis: a tie goes by name order, so it is never zero. */
const sideOf = (from: number, to: number, p: Body, q: Body) => (to > from ? 1 : to < from ? -1 : p.repository < q.repository ? 1 : -1);

/** Keeps a body's box `MARGIN` px inside the sky. */
function keepInside(body: Body, height: number): void {
  const half = body.width / 2;
  body.x = Math.min(Math.max(body.x, MARGIN + half), SKY_WIDTH - MARGIN - half);
  body.y = Math.min(Math.max(body.y, MARGIN + BOX_ABOVE), height - MARGIN - (BOX_HEIGHT - BOX_ABOVE));
}

/** Adds `(fx, fy)` to `q`'s force and takes it from `p`'s. */
function push(p: Body, q: Body, fx: number, fy: number): void {
  p.fx -= fx; p.fy -= fy;
  q.fx += fx; q.fy += fy;
}

/** The stars on the seeded spiral, in name order, each box inside the sky. */
function spiralOf(sorted: readonly LayoutStar[], seed: string, height: number): Body[] {
  const turn = unitOf(seed) * 2 * Math.PI;
  return sorted.map((star, i) => {
    const angle = turn + GOLDEN * i;
    const radius = 40 + 54 * Math.sqrt(i);
    const body = { star, repository: star.repository, width: widthOf(star), x: SKY_WIDTH / 2 + radius * Math.cos(angle), y: height / 2 + FLATTEN * radius * Math.sin(angle), fx: 0, fy: 0 };
    keepInside(body, height);
    return body;
  });
}

/** The lines between two different stars both placed, each pulling by its weight, six at most. */
function springsOf(bodies: readonly Body[], lines: readonly LayoutLine[]): Spring[] {
  const byName = new Map(bodies.map((b) => [b.repository, b]));
  return lines.flatMap((line) => {
    const p = byName.get(line.a);
    const q = byName.get(line.b);
    return p === undefined || q === undefined || p === q ? [] : [{ p, q, pull: PULL * Math.min(line.weight, MAX_WEIGHT) }];
  });
}

/** Two stars repel by `26000 / d²`, and two boxes that overlap push apart along the shorter axis. */
function repel(p: Body, q: Body): void {
  const d = Math.max(Math.hypot(q.x - p.x, q.y - p.y), 1);
  const ux = d > 1 ? (q.x - p.x) / d : sideOf(p.x, q.x, p, q);
  const uy = d > 1 ? (q.y - p.y) / d : 0;
  const { across, down } = overlapOf(p, q, 0);
  const boxes = across > 0 && down > 0;
  const fx = (REPULSION / (d * d)) * ux + (boxes && across < down ? BOX_PUSH * across * sideOf(p.x, q.x, p, q) : 0);
  const fy = (REPULSION / (d * d)) * uy + (boxes && across >= down ? BOX_PUSH * down * sideOf(p.y, q.y, p, q) : 0);
  push(p, q, fx, fy);
}

/** A line pulls its ends together past 150 px apart, and apart within it. */
function pull({ p, q, pull: strength }: Spring): void {
  const d = Math.max(Math.hypot(q.x - p.x, q.y - p.y), 1);
  const f = strength * (d - REST);
  push(p, q, (-f * (q.x - p.x)) / d, (-f * (q.y - p.y)) / d);
}

/** One step of the forces: each star moves at most `30 × (1 − step / 300) + 2` px, its box kept inside. */
function stepOf(bodies: readonly Body[], springs: readonly Spring[], step: number, height: number): void {
  for (const b of bodies) {
    b.fx = CENTRE_X * (SKY_WIDTH / 2 - b.x);
    b.fy = CENTRE_Y * (height / 2 - b.y);
  }
  for (const [p, q] of pairsOf(bodies)) repel(p, q);
  springs.forEach(pull);
  const cap = 30 * (1 - step / STEPS) + 2;
  for (const b of bodies) {
    const size = Math.hypot(b.fx, b.fy);
    const scale = size > cap ? cap / size : 1;
    b.x += b.fx * scale;
    b.y += b.fy * scale;
    keepInside(b, height);
  }
}

/** Moves two overlapping boxes apart by their whole overlap (and the gap) along the shorter axis; false when they do not overlap. */
function separate(p: Body, q: Body, height: number): boolean {
  const { across, down } = overlapOf(p, q, GAP);
  if (across <= 0 || down <= 0) return false;
  if (across < down) {
    const half = (sideOf(p.x, q.x, p, q) * across) / 2;
    p.x -= half; q.x += half;
  } else {
    const half = (sideOf(p.y, q.y, p, q) * down) / 2;
    p.y -= half; q.y += half;
  }
  keepInside(p, height);
  keepInside(q, height);
  return true;
}

/** The separation pass: rounds over every pair until no box overlaps another, 400 at most. */
function separateAll(bodies: readonly Body[], height: number): void {
  const pairs = pairsOf(bodies);
  for (let pass = 0; pass < ROUNDS; pass += 1) {
    let moved = false;
    for (const [p, q] of pairs) moved = separate(p, q, height) || moved;
    if (!moved) return;
  }
}

/** Where each star of `stars` sits in the sky, `lines` pulling their ends together, `seed` turning the start. */
export function layoutOf(stars: readonly LayoutStar[], lines: readonly LayoutLine[], seed: string): Layout {
  const sorted = [...stars].sort((p, q) => (p.repository < q.repository ? -1 : p.repository > q.repository ? 1 : 0));
  const height = skyHeightOf(sorted.length);
  const bodies = spiralOf(sorted, seed, height);
  const springs = springsOf(bodies, lines);
  for (let step = 0; step < STEPS; step += 1) stepOf(bodies, springs, step, height);
  separateAll(bodies, height);

  const at = new Map<string, Point>();
  const boxes = new Map<string, Box>();
  for (const { star, x, y } of bodies) {
    const point = { x: round(x), y: round(y) };
    at.set(star.repository, point);
    boxes.set(star.repository, labelBoxOf(star, point));
  }
  return { width: SKY_WIDTH, height, at, boxes };
}
