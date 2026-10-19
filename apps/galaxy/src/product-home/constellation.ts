import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { makeStarfield } from '@omni/design';
import { layoutOf, SKY_WIDTH, type Point } from './layout';
import type { HomeFlight, HomeRepository, PrChip, ProductHome } from './product-home.service';

// The Constellation tab's map (PRD 2129, reworked by PRD 2174 s3): one pure function from the product's
// linked repositories and its PRDs to the stars, their lines and where each is placed. No rule lives in the
// reads or the drawing.
//
// - a star per linked repository: its role, its phase 0 (◆ `server`, ◇ `pr`), the other products it is also
//   in, and its weight, the number of the product's PRDs whose targets include it, with its third (light,
//   medium, heavy) among the product's weights; a star whose phase 0 is `pr` is docked;
// - a plan line per pair of the product's repositories that a PRD's targets (its plan's `## Repositories`,
//   stored in prd_targets) name together: its weight is the PRDs sharing the pair, newest first; it is in
//   flight when one of them is (on the Ledger: not shipped, not at retro). A target outside the product's
//   repositories draws nothing and is counted on the stars of the PRD it comes with; a PRD with fewer than
//   two targets in the product draws no line;
// - a consumes line per declared `consumes` entry, consumer to provider, drawn apart: nothing is inferred;
// - the stars are placed by layoutOf (layout.ts), seeded with the product's id: the same rows, the same map;
// - a PRD in flight touches its home repository, every repository where it has a stage row, and every one
//   where its feature branch or a landing has an open pull request; a shipped PRD, or one at retro, touches
//   nothing;
// - a PRD's state is `drifted` (a ◆ PRD whose approval a push voided), else `on-you` (on the viewer's On
//   you lane), else `building` (at building), else `quiet`; a star's is the worst of the PRDs touching it;
// - *Now in* lists the first 8 PRDs in flight touching any star, worst first, and counts the rest;
// - a docked star carries one tether per open phase-0 pull request of the product's PRDs in its repository;
// - `?star=<owner/name>` selects one star and `?pair=<owner/name>,<owner/name>` one plan line, in either
//   order; an unknown value selects nothing. There is no PRD filter.

export type { Point };

/** A star's state, worst first; a PRD's own. */
export type StarState = 'drifted' | 'on-you' | 'building' | 'quiet';

/** The states in the order a star takes the worst of. */
const STAR_STATES: readonly StarState[] = ['drifted', 'on-you', 'building', 'quiet'];

/** How many PRDs *Now in* lists before it counts the rest. */
export const NOW_MAX = 8;

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

/** A star's third among the product's weights. */
export type StarSize = 'light' | 'medium' | 'heavy';

export interface Star {
  repository: string;
  role: string | null;
  phase0: 'pr' | 'server';
  docked: boolean;
  alsoIn: string[];
  /** The open phase-0 pull requests of the product's PRDs in it: only a docked star carries any. */
  tethers: PrChip[];
  /** How many of the product's PRDs have it among their targets. */
  weight: number;
  size: StarSize;
  /** How many repositories outside the product the PRDs that target it also target. */
  outside: number;
  at: Point;
  state: StarState;
}

/** A PRD sharing a plan line. */
export interface LinePrd {
  dossier: string;
  prd: PrdNumber;
  title: string;
  inFlight: boolean;
}

/** A plan line: a pair of the product's repositories (`a` sorts before `b`) that PRDs' targets name together. */
export interface PlanLine {
  a: string;
  b: string;
  /** How many PRDs share it. */
  weight: number;
  /** The PRDs sharing it, newest first. */
  prds: LinePrd[];
  inFlight: boolean;
}

/** A declared `consumes` entry, drawn apart. */
export interface ConsumesLine {
  consumer: string;
  provider: string;
}

/** What the map is drawn with: the star a `?star=` selects, the pair a `?pair=` selects. */
export interface Filter {
  star?: string | null;
  pair?: string | null;
}

/** What the tab draws: no repository, repositories alone, or repositories with their lines. */
export type Constellation =
  | { kind: 'empty' }
  | {
    kind: 'stars' | 'map';
    sky: { width: number; height: number };
    stars: Star[];
    lines: PlanLine[];
    consumes: ConsumesLine[];
    /** The first NOW_MAX PRDs in flight touching a star, worst first. */
    now: Flight[];
    /** How many more PRDs in flight touch a star. */
    moreNow: number;
    selected: Star | null;
    selectedLine: PlanLine | null;
  };

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

/** The key of a pair of repositories, the same in either order. */
const pairKey = (a: string, b: string) => (lower(a) < lower(b) ? `${lower(a)}|${lower(b)}` : `${lower(b)}|${lower(a)}`);

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

/** What the PRDs' targets say: the PRDs of each pair of the product's repositories, each repository's weight and
 * the repositories outside the product that come with it. */
function plansOf(flights: readonly HomeFlight[], names: readonly string[]) {
  const canonical = new Map(names.map((n) => [lower(n), n] as const));
  const lines = new Map<string, PlanLine>();
  const weights = new Map<string, number>();
  const outside = new Map<string, Set<string>>();
  for (const f of flights) {
    const inside = [...new Set(f.targets.flatMap((t) => canonical.get(lower(t)) ?? []))].sort((a, b) => a.localeCompare(b));
    const beyond = [...new Set(f.targets.filter((t) => !canonical.has(lower(t))).map(lower))];
    for (const name of inside) {
      weights.set(name, (weights.get(name) ?? 0) + 1);
      outside.set(name, new Set([...(outside.get(name) ?? []), ...beyond]));
    }
    const prd: LinePrd = { dossier: f.dossier, prd: f.prd, title: f.title, inFlight: f.ledger !== null };
    for (const [i, a] of inside.entries()) {
      for (const b of inside.slice(i + 1)) {
        const key = pairKey(a, b);
        const line = lines.get(key) ?? { a, b, weight: 0, prds: [], inFlight: false };
        lines.set(key, { ...line, weight: line.weight + 1, prds: [...line.prds, prd], inFlight: line.inFlight || prd.inFlight });
      }
    }
  }
  const sorted = [...lines.values()].sort((p, q) => q.weight - p.weight || p.a.localeCompare(q.a) || p.b.localeCompare(q.b));
  return { lines: sorted, weights, outside };
}

/** A weight's third among the product's weights: the lowest third light, the highest heavy. */
function sizesOf(weights: readonly number[]): (weight: number) => StarSize {
  const sorted = [...weights].sort((a, b) => a - b);
  const lowest = sorted[Math.ceil(sorted.length / 3) - 1] ?? 0;
  const middle = sorted[Math.ceil((2 * sorted.length) / 3) - 1] ?? 0;
  return (weight) => (weight <= lowest ? 'light' : weight <= middle ? 'medium' : 'heavy');
}

/** The pair a `?pair=` names, `owner/name,owner/name` in either order, as the line it selects. */
function pairOf(lines: readonly PlanLine[], pair: string | null | undefined): PlanLine | null {
  const names = pair?.split(',') ?? [];
  const [first, second] = names;
  if (names.length !== 2 || first === undefined || second === undefined) return null;
  return lines.find((l) => pairKey(l.a, l.b) === pairKey(first, second)) ?? null;
}

type Home = Pick<ProductHome, 'product' | 'repositories' | 'flights'> & Partial<Pick<ProductHome, 'tethers'>>;

/** The stars of the product, with what its PRDs say of them, placed by the layout, before the Ledger is drawn on them. */
function starsOf(repositories: readonly HomeRepository[], tethers: readonly PrChip[], plans: ReturnType<typeof plansOf>, seed: string) {
  const sorted = [...repositories].sort((a, b) => a.repository.localeCompare(b.repository));
  const layout = layoutOf(
    sorted.map((r) => ({ repository: r.repository, role: r.role })),
    plans.lines.map((l) => ({ a: l.a, b: l.b, weight: l.weight })),
    seed,
  );
  const sizeOf = sizesOf(sorted.map((r) => plans.weights.get(r.repository) ?? 0));
  return {
    sky: { width: layout.width, height: layout.height },
    placed: sorted.map((r) => {
      const weight = plans.weights.get(r.repository) ?? 0;
      return {
        repository: r.repository,
        role: r.role,
        phase0: r.phase0,
        docked: r.phase0 === 'pr',
        alsoIn: [...r.alsoIn].sort((a, b) => a.localeCompare(b)),
        tethers: r.phase0 === 'pr' ? tethers.filter((t) => lower(t.repo) === lower(r.repository)) : [],
        weight,
        size: sizeOf(weight),
        outside: plans.outside.get(r.repository)?.size ?? 0,
        at: layout.at.get(r.repository) ?? { x: SKY_WIDTH / 2, y: layout.height / 2 },
      };
    }),
  };
}

/** The product's constellation from its linked repositories and its PRDs, with `filter`'s selection. */
export function constellationOf(home: Home, filter: Filter = {}): Constellation {
  const { repositories } = home;
  if (repositories.length === 0) return { kind: 'empty' };
  const plans = plansOf(home.flights, repositories.map((r) => r.repository));
  const { sky, placed } = starsOf(repositories, home.tethers ?? [], plans, home.product.id);
  const flights = flightsOf(home.flights, placed.map((s) => s.repository));
  const stars: Star[] = placed.map((s) => ({ ...s, state: worst(flights.filter((f) => f.stars.includes(s.repository)).map((f) => f.state)) }));
  const known = new Set(stars.map((s) => s.repository));
  const consumes = repositories.flatMap((r) => r.consumes.filter((p) => known.has(p)).map((p) => ({ consumer: r.repository, provider: p })));
  const touching = flights.filter((f) => f.stars.length > 0).sort((a, b) => rankOf(a.state) - rankOf(b.state));
  const wanted = filter.star === undefined || filter.star === null ? null : lower(filter.star);
  return {
    kind: plans.lines.length === 0 ? 'stars' : 'map',
    sky,
    stars,
    lines: plans.lines,
    consumes,
    now: touching.slice(0, NOW_MAX),
    moreNow: Math.max(0, touching.length - NOW_MAX),
    selected: stars.find((s) => lower(s.repository) === wanted) ?? null,
    selectedLine: pairOf(plans.lines, filter.pair),
  };
}

/** How many background stars the sky holds, and how many of them twinkle at most. */
const FIELD_COUNT = 140;
const TWINKLE_MAX = 60;

/** The product's id as a whole number: the seed of its field of stars. */
function seedOf(id: string): number {
  let h = 17;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
  return h;
}

/** A background star of the sky: where it sits, how big, and whether it twinkles (the first TWINKLE_MAX only). */
export interface FieldStar {
  x: number;
  y: number;
  r: number;
  twinkle: boolean;
  /** Its twinkle's delay in seconds, from its phase. */
  delay: number;
}

/** The field behind the stars: the same for the same product and sky. */
export function fieldOf(productId: string, width: number, height: number): FieldStar[] {
  return makeStarfield(seedOf(productId), width, height, FIELD_COUNT).map((s, i) => ({
    x: Math.round(s.x * 10) / 10,
    y: Math.round(s.y * 10) / 10,
    r: s.big ? 1.6 : 0.9,
    twinkle: i < TWINKLE_MAX,
    delay: Math.round(s.phase * 10) / 10,
  }));
}
