import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { HomeFlight, HomeRepository, PrChip, ProductHome } from './product-home.service';

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
//
// Since s2, the Ledger's states on it:
//
// - a PRD in flight (on the Ledger: not shipped, not at retro) touches its home repository, every
//   repository where it has a stage row, and every one where its feature branch or a landing has an open
//   pull request; a shipped PRD, or one at retro, touches nothing;
// - a PRD's state is `drifted` (a ◆ PRD whose approval a push voided), else `on-you` (on the viewer's On
//   you lane), else `building` (at building), else `quiet`; a star's is the worst of the PRDs touching it,
//   in that order;
// - an edge carries what crosses it now: the PRDs in flight touching both of its ends, newest first; it
//   flows (its dots move) only between two building stars;
// - *Now in* lists the PRDs in flight touching any star, worst first;
// - a docked star carries one tether per open phase-0 pull request of the product's PRDs in its repository
//   (s3); a star that is not docked never carries one;
// - `?prd=<dossier>` keeps that PRD's stars and the edges between them lit and fades the rest, an unknown
//   one (or one not in flight) reading as no filter; `?star=<owner/name>` selects one star, an unknown one
//   none.

/** The sky's size, in the SVG's own units. */
export const SKY = { width: 960, height: 500 } as const;

export interface Point {
  x: number;
  y: number;
}

/** A star's state, worst first; a PRD's own. */
export type StarState = 'drifted' | 'on-you' | 'building' | 'quiet';

/** The states in the order a star takes the worst of. */
const STAR_STATES: readonly StarState[] = ['drifted', 'on-you', 'building', 'quiet'];

/** A PRD in flight, as the map draws it. */
export interface Flight {
  dossier: string;
  prd: PrdNumber;
  title: string;
  state: StarState;
  /** Its state in words: `drifted`, `waits on you`, `building`, else its Ledger state word. */
  word: string;
  /** The stars it touches, in the stars' order. */
  stars: string[];
}

export interface Star {
  repository: string;
  role: string | null;
  phase0: 'pr' | 'server';
  docked: boolean;
  alsoIn: string[];
  /** The open phase-0 pull requests of the product's PRDs in it: only a docked star carries any. */
  tethers: PrChip[];
  /** How many links consume it. */
  consumedBy: number;
  at: Point;
  state: StarState;
  /** False when a `?prd=` filter is in force and that PRD does not touch it. */
  lit: boolean;
}

export interface Edge {
  consumer: string;
  provider: string;
  /** The curve's control point. */
  bend: Point;
  /** The PRDs in flight touching both of its ends, newest first. */
  crossing: Flight[];
  lit: boolean;
  /** Whether its dots move: both of its ends are building. */
  flowing: boolean;
}

/** What the map is drawn with: the dossier of the PRD a `?prd=` lights, the star a `?star=` selects. */
export interface Filter {
  dossier?: string | null;
  star?: string | null;
}

/** What the tab draws: no repository, repositories alone, or repositories with their edges. */
export type Constellation =
  | { kind: 'empty' }
  | {
    kind: 'stars' | 'map';
    stars: Star[];
    edges: Edge[];
    /** Every PRD in flight, newest first: the filter's chips. */
    flights: Flight[];
    /** The PRDs in flight touching a star, worst first. */
    now: Flight[];
    /** The dossier of the PRD lit, or null with no filter in force. */
    lit: string | null;
    selected: Star | null;
  };

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

const lower = (repository: string) => repository.toLowerCase();

/** The repositories a PRD touches, in lower case: none once shipped or at retro. */
export function touchesOf(flight: HomeFlight): string[] {
  if (flight.ledger === null) return [];
  return [...new Set([flight.repo, ...flight.stageRepos, ...flight.prs.map((p) => p.repo)].map(lower))];
}

/** A PRD's own state: drifted, waits on you, building, or quiet. */
function stateOf(flight: HomeFlight): StarState {
  if (flight.ledger?.state === 'drifted') return 'drifted';
  if (flight.ledger?.lane === 'on-you') return 'on-you';
  return flight.stage === 'building' ? 'building' : 'quiet';
}

const WORDS: Readonly<Record<Exclude<StarState, 'quiet'>, string>> = { drifted: 'drifted', 'on-you': 'waits on you', building: 'building' };

const rankOf = (state: StarState) => STAR_STATES.indexOf(state);
const worst = (states: readonly StarState[]): StarState => states.reduce<StarState>((w, s) => (rankOf(s) < rankOf(w) ? s : w), 'quiet');

/** The stars of the product, ranked and placed, before the Ledger is drawn on them. */
function placedOf(repositories: readonly HomeRepository[], tethers: readonly PrChip[]) {
  const consumedBy = new Map<string, number>();
  for (const r of repositories) for (const p of r.consumes) consumedBy.set(p, (consumedBy.get(p) ?? 0) + 1);
  const ranked = [...repositories].sort((a, b) =>
    (consumedBy.get(b.repository) ?? 0) - (consumedBy.get(a.repository) ?? 0) || a.repository.localeCompare(b.repository));
  const places = placesOf(ranked.length);
  return ranked.map((r, i) => ({
    repository: r.repository,
    role: r.role,
    phase0: r.phase0,
    docked: r.phase0 === 'pr',
    alsoIn: [...r.alsoIn].sort((a, b) => a.localeCompare(b)),
    tethers: r.phase0 === 'pr' ? tethers.filter((t) => lower(t.repo) === lower(r.repository)) : [],
    consumedBy: consumedBy.get(r.repository) ?? 0,
    at: places[i] ?? CENTRE,
  }));
}

/** The PRDs in flight, newest first, each with the stars it touches. */
function flightsOf(flights: readonly HomeFlight[], starNames: readonly string[]): Flight[] {
  return flights.flatMap((f) => {
    if (f.ledger === null) return [];
    const touches = new Set(touchesOf(f));
    const state = stateOf(f);
    const word = state === 'quiet' ? f.ledger.state : WORDS[state];
    return [{ dossier: f.dossier, prd: f.prd, title: f.title, state, word, stars: starNames.filter((n) => touches.has(lower(n))) }];
  });
}

/** The product's constellation from its linked repositories and its PRDs, drawn with `filter`. */
export function constellationOf(home: Pick<ProductHome, 'repositories' | 'flights'> & Partial<Pick<ProductHome, 'tethers'>>, filter: Filter = {}): Constellation {
  const { repositories } = home;
  if (repositories.length === 0) return { kind: 'empty' };
  const placed = placedOf(repositories, home.tethers ?? []);
  const flights = flightsOf(home.flights, placed.map((s) => s.repository));
  const lit = flights.find((f) => f.dossier === filter.dossier) ?? null;
  const touching = (name: string) => flights.filter((f) => f.stars.includes(name));
  const stars: Star[] = placed.map((s) => ({
    ...s, state: worst(touching(s.repository).map((f) => f.state)), lit: lit === null || lit.stars.includes(s.repository),
  }));
  const byName = new Map(stars.map((s) => [s.repository, s] as const));
  const declared = repositories.flatMap((r) => r.consumes.filter((p) => byName.has(p)).map((p) => ({ consumer: r.repository, provider: p })));
  const edges: Edge[] = declared.flatMap((e) => {
    const from = byName.get(e.consumer);
    const to = byName.get(e.provider);
    if (from === undefined || to === undefined) return [];
    const bothWays = declared.some((o) => o.consumer === e.provider && o.provider === e.consumer);
    return [{
      ...e,
      bend: bendOf(from.at, to.at, bothWays),
      crossing: flights.filter((f) => f.stars.includes(e.consumer) && f.stars.includes(e.provider)),
      lit: from.lit && to.lit,
      flowing: from.state === 'building' && to.state === 'building',
    }];
  });
  const now = [...flights].filter((f) => f.stars.length > 0).sort((a, b) => rankOf(a.state) - rankOf(b.state));
  const wanted = filter.star === undefined || filter.star === null ? null : lower(filter.star);
  const selected = stars.find((s) => lower(s.repository) === wanted) ?? null;
  return { kind: edges.length === 0 ? 'stars' : 'map', stars, edges, flights, now, lit: lit?.dossier ?? null, selected };
}
