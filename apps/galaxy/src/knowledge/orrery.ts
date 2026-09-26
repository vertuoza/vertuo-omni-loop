import { orbits, type EntryKind, type KnowledgeEntry } from '../data/knowledge';

// The /knowledge page's diagram (PRD 149), laid out by hand like the galaxy map: the domain's sun in
// the middle, principles on the inner orbit, rules on the middle one, invariants outside. Each orbit
// seats its entries in id order, evenly, clockwise from the top. An orbit that cannot seat them at
// the smallest spacing spills onto one more orbit of the same kind, further out, so every entry is
// always shown and no two dots touch; the diagram grows, and the page scales it to its width.

/** The diagram's measures, in its own units (the SVG's viewBox). */
export const ORRERY = {
  /** The sun's radius. */
  sun: 24,
  /** The inner orbit's radius. */
  first: 76,
  /** From the last orbit of one kind to the first of the next. */
  kindGap: 46,
  /** From an orbit to the one its crowd spills onto. */
  spillGap: 24,
  /** The least distance along an orbit between two dots' centres. */
  spacing: 18,
  /** A dot's radius. */
  dot: 5,
  /** Room outside the outer orbit: the selection ring, then a margin. */
  margin: 22,
} as const;

export interface OrreryRing { kind: EntryKind; r: number }
export interface OrreryDot { entry: KnowledgeEntry; x: number; y: number }
export interface Orrery {
  /** The square's side; the sun sits at (center, center). */
  size: number;
  center: number;
  sun: number;
  dot: number;
  rings: OrreryRing[];
  dots: OrreryDot[];
}

/** How many dots an orbit of radius `r` seats at the smallest spacing. */
const capacity = (r: number) => Math.max(1, Math.floor((2 * Math.PI * r) / ORRERY.spacing));
const round = (n: number) => Math.round(n * 10) / 10;

export function orrery(entries: KnowledgeEntry[]): Orrery {
  const rings: OrreryRing[] = [];
  const seats: { entry: KnowledgeEntry; r: number; angle: number }[] = [];
  let r = ORRERY.first - ORRERY.kindGap;
  for (const orbit of orbits(entries)) {
    r += ORRERY.kindGap;
    const radii = [r];
    for (let room = capacity(r); room < orbit.entries.length; room += capacity(r)) {
      r += ORRERY.spillGap;
      radii.push(r);
    }
    // Outer orbits seat more; each takes an even share of what is left, up to what it seats.
    let rest = orbit.entries;
    radii.forEach((radius, i) => {
      const share = Math.min(capacity(radius), Math.ceil(rest.length / (radii.length - i)));
      const seated = rest.slice(0, share);
      rest = rest.slice(share);
      rings.push({ kind: orbit.kind, r: radius });
      // A spilled orbit turns half a step, so its dots do not line up with the one inside.
      const offset = i % 2 === 1 ? 0.5 : 0;
      seated.forEach((entry, k) => seats.push({ entry, r: radius, angle: -Math.PI / 2 + ((k + offset) * 2 * Math.PI) / seated.length }));
    });
  }
  const center = r + ORRERY.margin;
  return {
    size: 2 * center,
    center,
    sun: ORRERY.sun,
    dot: ORRERY.dot,
    rings,
    dots: seats.map(({ entry, r: radius, angle }) => ({ entry, x: round(center + radius * Math.cos(angle)), y: round(center + radius * Math.sin(angle)) })),
  };
}
