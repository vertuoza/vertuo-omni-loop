import type { HomeRepository } from './product-home.service';

// The Constellation tab's map (PRD 2129 s1): one pure function from the product's linked repositories to the
// stars, their edges and where each is placed. No rule lives in the reads or the drawing.
//
// - a star per linked repository: its role, its phase 0 (◆ `server`, ◇ `pr`) and the other products it is
//   also in; a star whose phase 0 is `pr` is docked;
// - an edge per `consumes` entry, from the consumer to the provider, as its owners declared it: nothing is
//   inferred;
// - a fixed layout, with no physics and no randomness: stars ranked by how many links consume them (most
//   first, ties by name); the first at the centre of the sky, the rest on one ring around it (two rings past
//   8 stars), evenly spaced from the top in rank order. An edge is a quadratic curve bent away from the
//   centre; two edges between the same pair bend to opposite sides, so they never overlap.

/** The sky's size, in the SVG's own units. */
export const SKY = { width: 960, height: 500 } as const;

export interface Point {
  x: number;
  y: number;
}

export interface Star {
  repository: string;
  role: string | null;
  phase0: 'pr' | 'server';
  docked: boolean;
  alsoIn: string[];
  /** How many links consume it. */
  consumedBy: number;
  at: Point;
}

export interface Edge {
  consumer: string;
  provider: string;
  /** The curve's control point. */
  bend: Point;
}

/** What the tab draws: no repository, repositories alone, or repositories with their edges. */
export type Constellation =
  | { kind: 'empty' }
  | { kind: 'stars' | 'map'; stars: Star[]; edges: Edge[] };

const CENTRE: Point = { x: SKY.width / 2, y: SKY.height / 2 };
/** Radii of the ring (one ring up to 8 stars), then of the inner and the outer ring. */
const RING = 190;
const INNER = 120;
const OUTER = 215;
const ONE_RING_MAX = 8;
/** How far an edge bends, as a share of its length. */
const BEND = 0.18;

const round = (n: number) => Math.round(n * 10) / 10;

/** `count` points evenly spaced on the ring of `radius`, from the top, clockwise. */
const ring = (count: number, radius: number): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: round(CENTRE.x + radius * Math.cos(angle)), y: round(CENTRE.y + radius * Math.sin(angle)) };
  });

/** The points of `total` stars, in rank order: the centre, then the ring or two. */
function placesOf(total: number): Point[] {
  const others = total - 1;
  if (others <= 0) return total === 1 ? [CENTRE] : [];
  if (total <= ONE_RING_MAX) return [CENTRE, ...ring(others, RING)];
  const inner = Math.ceil(others / 2);
  return [CENTRE, ...ring(inner, INNER), ...ring(others - inner, OUTER)];
}

/** The control point of the curve from `from` to `to`: the middle pushed sideways, away from the centre,
 * or to the left of the way it goes when the same pair has an edge the other way too. */
function bendOf(from: Point, to: Point, bothWays: boolean): Point {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const normal = { x: from.y - to.y, y: to.x - from.x };
  const away = normal.x * (mid.x - CENTRE.x) + normal.y * (mid.y - CENTRE.y) >= 0 ? 1 : -1;
  const side = bothWays ? 1 : away;
  return { x: round(mid.x + side * normal.x * BEND), y: round(mid.y + side * normal.y * BEND) };
}

/** The product's constellation from its linked repositories. */
export function constellationOf(repositories: readonly HomeRepository[]): Constellation {
  if (repositories.length === 0) return { kind: 'empty' };
  const names = new Set(repositories.map((r) => r.repository));
  const consumedBy = new Map<string, number>();
  for (const r of repositories) for (const p of r.consumes) consumedBy.set(p, (consumedBy.get(p) ?? 0) + 1);
  const ranked = [...repositories].sort((a, b) =>
    (consumedBy.get(b.repository) ?? 0) - (consumedBy.get(a.repository) ?? 0) || a.repository.localeCompare(b.repository));
  const places = placesOf(ranked.length);
  const stars: Star[] = ranked.map((r, i) => ({
    repository: r.repository,
    role: r.role,
    phase0: r.phase0,
    docked: r.phase0 === 'pr',
    alsoIn: [...r.alsoIn].sort((a, b) => a.localeCompare(b)),
    consumedBy: consumedBy.get(r.repository) ?? 0,
    at: places[i] ?? CENTRE,
  }));
  const at = new Map(stars.map((s) => [s.repository, s.at] as const));
  const declared = repositories.flatMap((r) => r.consumes.filter((p) => names.has(p)).map((p) => ({ consumer: r.repository, provider: p })));
  const edges: Edge[] = declared.flatMap((e) => {
    const from = at.get(e.consumer);
    const to = at.get(e.provider);
    if (from === undefined || to === undefined) return [];
    const bothWays = declared.some((o) => o.consumer === e.provider && o.provider === e.consumer);
    return [{ ...e, bend: bendOf(from, to, bothWays) }];
  });
  return { kind: edges.length === 0 ? 'stars' : 'map', stars, edges };
}
