// The star chart's layouts, pure: where each domain's sun sits on the `chart`, where each entry's world
// circles its sun in the `system`, and where the D-pad and a tap go on each. The canvas draws them
// (chart.ts), the text layer labels them (chart.tsx), and nothing here moves with time: the orbits
// hold still, so a world stays where the D-pad and a finger expect it.
import { rng } from '@omni/design';
import { entriesOf, lanes, orbits, systems, type EntryKind, type KnowledgeEntry, type KnowledgeGraph, type KnowledgeSystem } from '../../data/knowledge';
import type { Action } from '../keys';
import type { Grid, GridName } from './common.ts';
import { neighbour } from './map.ts';

export interface Box { x: number; y: number; w: number; h: number }
export type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * What the star chart shows: the graph; `null` when it is out of reach (nobody past the crew's gate,
 * or the knowledge files could not be read); `'none'` in a build that carries no star chart at all
 * (the single-file artifact).
 */
export type ChartSource = KnowledgeGraph | 'none' | null;

// ── The chart: a sun per domain ──────────────────────────────────────────────

/**
 * The chart's lines on each grid: the band the suns and their labels sit in (the HUD above it, the
 * dialog under it), the room each sun's label takes under it, and the smallest and largest sun.
 */
export const CHART_LINES: Record<GridName, { band: Box; label: number; sun: { min: number; max: number } }> = {
  wide: { band: { x: 16, y: 34, w: 608, h: 200 }, label: 30, sun: { min: 10, max: 40 } },
  tall: { band: { x: 6, y: 24, w: 308, h: 146 }, label: 26, sun: { min: 7, max: 24 } },
};

/** How far a sun's corona reaches, as a share of its radius (drawSun's `sunSize`, rounded up). */
const CORONA = 1.4;

/** A domain's sun; `label` is how wide its name may run under it, kept inside its own cell. */
export interface SunSlot { name: string; x: number; y: number; r: number; index: number; seed: number; label: number; system: KnowledgeSystem }
/** A cross-domain file: a dotted lane between two suns, with how many entries it holds. */
export interface LaneSlot { from: number; to: number; count: number }
export interface ChartLayout { suns: SunSlot[]; lanes: LaneSlot[] }

/** A name's seed: the same sun for the same domain on every load. */
function hashOf(name: string): number {
  let h = 2166136261;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** The product's sun burns gold (`drawSun` reads its colour from the seed's last two bits), the others red, blue or violet. */
export function sunSeed(system: Pick<KnowledgeSystem, 'name' | 'scope'>): number {
  const h = hashOf(system.name);
  return ((h & ~3) | (system.scope === 'product' ? 0 : 1 + (h % 3))) >>> 0;
}

/**
 * Where each domain's sun sits on `grid`: in rows across the band, the product first, a short last
 * row centred, each sun sized by how many entries it holds (within the smallest and the largest).
 * One domain sits in the middle.
 */
export function layoutChart(graph: KnowledgeGraph, grid: Grid): ChartLayout {
  const list = systems(graph);
  const n = list.length;
  if (!n) return { suns: [], lanes: [] };
  const { band, label, sun } = CHART_LINES[grid.name];
  const cols = n <= 3 ? n : Math.ceil(Math.sqrt((n * band.w) / band.h));
  const rows = Math.ceil(n / cols);
  const cellW = band.w / cols, cellH = band.h / rows;
  // The largest sun a cell leaves room for, corona and label included.
  const room = Math.floor(Math.min(cellW - 4, cellH - label - 4) / 2 / CORONA);
  const big = Math.max(3, Math.min(sun.max, room));
  const small = Math.min(sun.min, big);
  const most = Math.max(1, ...list.map((s) => s.size));
  const suns = list.map((system, index) => {
    const row = Math.floor(index / cols), col = index % cols;
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const r = Math.round(small + (big - small) * Math.sqrt(system.size / most));
    const seed = sunSeed(system);
    const rand = rng(seed);
    const slackX = Math.max(0, cellW / 2 - r * CORONA - 2), slackY = Math.max(0, (cellH - label) / 2 - r * CORONA - 2);
    const left = band.x + (col + (cols - inRow) / 2) * cellW;
    const x = Math.round(left + cellW / 2 + (n > 1 ? (rand() - 0.5) * slackX : 0));
    const y = Math.round(band.y + (row + 0.5) * cellH - label / 2 + (n > 1 ? (rand() - 0.5) * slackY : 0));
    const width = Math.floor(2 * Math.min(x - left, left + cellW - x) - 4);
    return { name: system.name, x, y, r, index, seed, label: width, system };
  });
  const at = new Map(suns.map((s) => [s.name, s.index]));
  const laneSlots = lanes(graph).flatMap((lane) => {
    const from = at.get(lane.pair[0]), to = at.get(lane.pair[1]);
    return from === undefined || to === undefined || from === to ? [] : [{ from, to, count: lane.entries.length }];
  });
  return { suns, lanes: laneSlots };
}

/** The sun in `dir` from sun `from` (the galaxy map's own rule: the closest, preferring straight lines). */
export function chartStep(layout: ChartLayout, from: number, dir: Dir): number {
  return neighbour(layout.suns, from, dir);
}

/** The sun a tap at `p` lands on, if any. */
export function sunAt(layout: ChartLayout, p: { x: number; y: number }): SunSlot | null {
  const hits = layout.suns.filter((s) => Math.hypot(s.x - p.x, s.y - p.y) <= Math.max(s.r * CORONA, 10));
  return hits.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] ?? null;
}

// ── The system: one domain as an orrery ──────────────────────────────────────

/**
 * The system's lines on each grid: the diagram's box (the panel beside it on the wide grid, under it
 * on the tall one), the sun's radius in its middle, and the largest and the smallest world.
 */
export const SYSTEM_LINES: Record<GridName, { diagram: Box; sun: number; world: { max: number; min: number } }> = {
  wide: { diagram: { x: 4, y: 30, w: 396, h: 326 }, sun: 16, world: { max: 8, min: 2 } },
  tall: { diagram: { x: 2, y: 22, w: 316, h: 150 }, sun: 9, world: { max: 7, min: 2 } },
};

/** One orbit: its kind, its ellipse around the sun, and how many worlds it carries. */
export interface OrbitSlot { kind: EntryKind; rx: number; ry: number; count: number }

/** A world: an entry on its orbit. `angle` is where on the orbit it sits (0 at the top, growing clockwise). */
export interface WorldSlot { entry: KnowledgeEntry; x: number; y: number; r: number; index: number; orbit: number; angle: number }

export interface SystemLayout {
  name: string;
  cx: number; cy: number;
  /** The sun's radius. */
  sun: number;
  /** Inner to outer: the principles' orbits, the rules', the invariants'. */
  orbits: OrbitSlot[];
  /** Orbit by orbit, each clockwise from the top, in id order. */
  worlds: WorldSlot[];
}

/** The space kept between two worlds on an orbit, for a world of radius `r`. */
const gapFor = (r: number) => 2 + Math.round(r / 4);

interface Arc { rx: number; ry: number; theta: Float64Array; length: Float64Array; total: number }

const SAMPLES = 256;

/** An ellipse measured along its length, from the top, clockwise: equal steps along it are equal distances. */
function arcOf(rx: number, ry: number): Arc {
  const theta = new Float64Array(SAMPLES + 1), length = new Float64Array(SAMPLES + 1);
  let px = 0, py = -ry, sum = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2;
    const x = rx * Math.sin(a), y = -ry * Math.cos(a);
    sum += Math.hypot(x - px, y - py);
    theta[i] = a;
    length[i] = sum;
    px = x; py = y;
  }
  return { rx, ry, theta, length, total: sum };
}

/** `n` points evenly spread along the ellipse, the first `offset` of a step past the top. */
function spread(arc: Arc, n: number, offset: number): { x: number; y: number; angle: number }[] {
  const out: { x: number; y: number; angle: number }[] = [];
  let i = 1;
  for (let j = 0; j < n; j++) {
    const s = (((j + offset) / n) % 1) * arc.total;
    if (s < arc.length[i - 1]!) i = 1;
    while (i < SAMPLES && arc.length[i]! < s) i++;
    const k = (s - arc.length[i - 1]!) / Math.max(1e-9, arc.length[i]! - arc.length[i - 1]!);
    const angle = arc.theta[i - 1]! + (arc.theta[i]! - arc.theta[i - 1]!) * k;
    out.push({ x: arc.rx * Math.sin(angle), y: -arc.ry * Math.cos(angle), angle });
  }
  return out;
}

/** True when `n` worlds of radius `r` spread on the ellipse keep `gap` between each two neighbours, either way an orbit is turned. */
function seats(arc: Arc, n: number, r: number, gap: number): boolean {
  if (n < 2) return true;
  return [0, 0.5].every((offset) => {
    const pts = spread(arc, n, offset);
    return pts.every((p, j) => {
      const q = pts[(j + 1) % n]!;
      return Math.hypot(p.x - q.x, p.y - q.y) >= 2 * r + gap;
    });
  });
}

/** How many worlds of radius `r` the ellipse seats. */
function capacity(arc: Arc, r: number, gap: number): number {
  let n = Math.floor(arc.total / (2 * r + gap));
  while (n > 1 && !seats(arc, n, r, gap)) n--;
  return Math.max(1, n);
}

/** `n` shared over places that seat `caps`, in proportion, none past its cap. */
function share(n: number, caps: number[]): number[] {
  const total = caps.reduce((a, b) => a + b, 0);
  const exact = caps.map((c) => (total ? (n * c) / total : 0));
  const out = exact.map((e, i) => Math.min(caps[i]!, Math.floor(e)));
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  while (left > 0) {
    const before = left;
    for (const { i } of order) {
      if (left > 0 && out[i]! < caps[i]!) { out[i]!++; left--; }
    }
    if (left === before) { out[out.length - 1]! += left; left = 0; } // more than they seat: the last takes the rest
  }
  return out;
}

interface Ring { kind: EntryKind; ry: number; entries: KnowledgeEntry[] }

/**
 * The orbits for worlds of radius `r` on `count` orbits spread evenly from the sun out to the edge of
 * the box: each kind takes one orbit, and as many more, further out, as its worlds need. Null when
 * they do not fit: the orbits closer than two worlds, or a kind out of orbits.
 */
function fit(kinds: { kind: EntryKind; entries: KnowledgeEntry[] }[], r: number, count: number, room: { ax: number; ay: number; inner: number }, force = false): Ring[] | null {
  const gap = gapFor(r);
  const { ax, ay, inner } = room;
  if (inner > ay) return null;
  const step = count > 1 ? (ay - inner) / (count - 1) : 0;
  if (!force && count > 1 && step < 2 * r + gap) return null;
  const sizes = Array.from({ length: count }, (_, i) => inner + i * step);
  const caps = sizes.map((ry) => capacity(arcOf((ry * ax) / ay, ry), r, gap));
  const rings: Ring[] = [];
  let next = 0;
  // Forced (nothing fits even at the smallest size), each kind takes orbits in proportion to its worlds.
  const forced = force ? share(count - kinds.length, kinds.map((k) => k.entries.length)).map((extra) => extra + 1) : null;
  for (const [k, { kind, entries }] of kinds.entries()) {
    const start = next;
    let seated = 0;
    if (forced) next += forced[k]!;
    else {
      do {
        if (next >= count) return null;
        seated += caps[next]!;
        next++;
      } while (seated < entries.length);
    }
    const counts = share(entries.length, caps.slice(start, next));
    let at = 0;
    counts.forEach((c, i) => { rings.push({ kind, ry: sizes[start + i]!, entries: entries.slice(at, at + c) }); at += c; });
  }
  return rings;
}

/**
 * The orrery of `entries` in `box`, the sun of radius `sun` in its middle: principles on the inner
 * orbit, rules on the middle one, invariants on the outer one, each world in id order clockwise from
 * the top. The worlds take the largest size that seats them all, from `world.max` down to
 * `world.min`; an orbit that cannot seat its worlds spills onto one more of the same kind, further
 * out. Every entry is always seated: past what the smallest size seats, worlds touch.
 */
export function layoutOrbits(entries: KnowledgeEntry[], box: Box, o: { sun: number; world: { max: number; min: number } }): Omit<SystemLayout, 'name'> {
  const cx = Math.round(box.x + box.w / 2), cy = Math.round(box.y + box.h / 2);
  const kinds = orbits(entries);
  const roomFor = (r: number) => ({ ax: box.w / 2 - r - 1, ay: box.h / 2 - r - 1, inner: o.sun + 3 + r });
  let rings: Ring[] | null = null, r = o.world.min;
  for (let size = o.world.max; size >= o.world.min && !rings; size--) {
    const room = roomFor(size);
    const most = Math.floor((room.ay - room.inner) / (2 * size + gapFor(size))) + 1;
    for (let count = kinds.length; count <= most && !rings; count++) {
      rings = fit(kinds, size, count, room);
      r = size;
    }
  }
  if (!rings) {
    const room = roomFor(r);
    const most = Math.max(kinds.length, Math.floor((room.ay - room.inner) / (2 * r + gapFor(r))) + 1);
    rings = fit(kinds, r, most, room, true)!;
  }
  const room = roomFor(r);
  const worlds: WorldSlot[] = [];
  const orbitSlots = rings.map((ring, orbit) => {
    const rx = (ring.ry * room.ax) / room.ay;
    const pts = spread(arcOf(rx, ring.ry), ring.entries.length, orbit % 2 ? 0.5 : 0);
    ring.entries.forEach((entry, j) => {
      const pt = pts[j]!;
      worlds.push({ entry, x: cx + pt.x, y: cy + pt.y, r, index: worlds.length, orbit, angle: pt.angle });
    });
    return { kind: ring.kind, rx, ry: ring.ry, count: ring.entries.length };
  });
  return { cx, cy, sun: o.sun, orbits: orbitSlots, worlds };
}

/** The system of `domain` on `grid`. */
export function layoutSystem(graph: KnowledgeGraph, domain: string, grid: Grid): SystemLayout {
  const { diagram, sun, world } = SYSTEM_LINES[grid.name];
  return { name: domain, ...layoutOrbits(entriesOf(graph, domain), diagram, { sun, world }) };
}

/** How far apart two places on an orbit are, as angles, the short way round. */
const apart = (a: number, b: number) => {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
};

/**
 * The world the D-pad reaches from world `from`: ◀ and ▶ the previous and the next on its orbit,
 * round from the last to the first; ▲ and ▼ the world nearest in angle on the next orbit in or out
 * that carries any (none further in or out: it stays).
 */
export function orbitStep(layout: SystemLayout, from: number, dir: Dir): number {
  const cur = layout.worlds[from];
  if (!cur) return layout.worlds.length ? 0 : from;
  if (dir === 'left' || dir === 'right') {
    const ring = layout.worlds.filter((w) => w.orbit === cur.orbit);
    const i = ring.indexOf(cur);
    return ring[(i + (dir === 'left' ? ring.length - 1 : 1)) % ring.length]!.index;
  }
  const step = dir === 'up' ? -1 : 1;
  for (let orbit = cur.orbit + step; orbit >= 0 && orbit < layout.orbits.length; orbit += step) {
    const ring = layout.worlds.filter((w) => w.orbit === orbit);
    if (!ring.length) continue;
    return ring.reduce((best, w) => (apart(w.angle, cur.angle) < apart(best.angle, cur.angle) ? w : best)).index;
  }
  return from;
}

/** The world a tap at `p` lands on, if any: the nearest whose disc (or a finger's width of it) is under it. */
export function worldAt(layout: SystemLayout, p: { x: number; y: number }): WorldSlot | null {
  let best: WorldSlot | null = null, bestD = Infinity;
  for (const w of layout.worlds) {
    const d = Math.hypot(w.x - p.x, w.y - p.y);
    if (d <= Math.max(w.r + 3, 7) && d < bestD) { best = w; bestD = d; }
  }
  return best;
}

// ── The pad on the two scenes ────────────────────────────────────────────────

/** Where the star chart's cursor is: the scene, the sun and the world under it, and the reading card. */
export interface ChartCursor { scene: 'chart' | 'system'; sun: number; world: number; card: boolean; cardPage: number }

/** What a press does on the star chart: the cursor it leaves (or the menu), and the sound it makes. */
export interface ChartMove {
  patch: Partial<Omit<ChartCursor, 'scene'>> & { scene?: ChartCursor['scene'] | 'menu' };
  sound: 'move' | 'select' | 'back' | 'tab';
}

/**
 * A press on `chart` or `system`, as a pure step. On the chart the D-pad moves between suns, SELECT to
 * the next, A (or START) enters the sun's system and B goes back to the menu. In a system ◀ ▶ ▲ ▼
 * move along and across the orbits (`orbitStep`), SELECT to the next world, A opens the reading card
 * and B goes back to the chart; on the card ▲ ▼ turn its `pages()` and B (or A, or START) closes it.
 * Null when the press does nothing.
 */
export function chartKey(cur: ChartCursor, action: Action, at: { chart: ChartLayout; system: SystemLayout | null; pages: () => number }): ChartMove | null {
  const dpad = action === 'up' || action === 'down' || action === 'left' || action === 'right';
  if (cur.scene === 'chart') {
    const n = at.chart.suns.length;
    if (action === 'b') return { patch: { scene: 'menu' }, sound: 'back' };
    if (!n) return null;
    if (dpad) {
      const sun = chartStep(at.chart, cur.sun, action);
      return sun === cur.sun ? null : { patch: { sun, world: 0 }, sound: 'move' };
    }
    if (action === 'select') return { patch: { sun: (cur.sun + 1) % n, world: 0 }, sound: 'move' };
    if (action === 'a' || action === 'start') return { patch: { scene: 'system', card: false }, sound: 'select' };
    return null;
  }
  const worlds = at.system?.worlds ?? [];
  if (cur.card && worlds[cur.world]) {
    if (action === 'up' || action === 'down') {
      const cardPage = Math.max(0, Math.min(at.pages() - 1, cur.cardPage + (action === 'up' ? -1 : 1)));
      return cardPage === cur.cardPage ? null : { patch: { cardPage }, sound: 'tab' };
    }
    if (action === 'b' || action === 'a' || action === 'start') return { patch: { card: false }, sound: 'back' };
    return null;
  }
  if (action === 'b') return { patch: { scene: 'chart', card: false }, sound: 'back' };
  if (!worlds.length || !at.system) return null;
  if (dpad) {
    const world = orbitStep(at.system, cur.world, action);
    return world === cur.world ? null : { patch: { world }, sound: 'move' };
  }
  if (action === 'select') return { patch: { world: (cur.world + 1) % worlds.length }, sound: 'move' };
  if (action === 'a' || action === 'start') return { patch: { card: true, cardPage: 0 }, sound: 'select' };
  return null;
}
