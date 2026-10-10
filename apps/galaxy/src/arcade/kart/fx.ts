// The race's particles (PRD 1427, slice 7), pure and seeded like race.ts: sparks where a kart scrapes a wall,
// a trail behind a kart on BOOST, a burst where an ORB or a BLOB hits, a flash where a box is taken. No DOM and
// no canvas: art.ts draws them. The same seed and the same steps give the same particles, and no more than
// `MAX_PARTICLES` are alive at once: a new one replaces the oldest.
import type { Race, RaceEvent } from './race';
import { draw } from './rivals';

export type ParticleKind = 'spark' | 'trail' | 'burst' | 'flash';

/** A particle: where it is on the floor (x, y) and above it (z), how it moves, and how long it has lived of its life, in seconds. */
export interface Particle { kind: ParticleKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number }

/** The particles alive, and the seeded generator the next ones come from. */
export interface Particles { list: readonly Particle[]; rng: number }

/** Something that happened where particles are born. */
export interface Spawn { kind: ParticleKind; x: number; y: number }

export const MAX_PARTICLES = 64;

/** How long each kind lives, how many one spawn makes, how fast they fly (world pixels a second) and how heavy they are. */
export const LOOK: Readonly<Record<ParticleKind, { life: number; count: number; speed: number; lift: number; gravity: number }>> = {
  spark: { life: 0.35, count: 5, speed: 60, lift: 40, gravity: 160 },
  trail: { life: 0.4, count: 1, speed: 6, lift: 4, gravity: 0 },
  burst: { life: 0.6, count: 10, speed: 90, lift: 50, gravity: 120 },
  flash: { life: 0.3, count: 6, speed: 30, lift: 30, gravity: 0 },
};

/** No particle yet, seeded from the race. */
export const newParticles = (seed: number): Particles => ({ list: [], rng: (seed ^ 0x1427) | 0 });

/** `dt` seconds of the particles: the living move and age, the ones at the end of their life go, then `spawns` are born (the oldest make room past the cap). */
export function stepParticles(p: Particles, spawns: readonly Spawn[], dt: number): Particles {
  let rng = p.rng;
  const list: Particle[] = p.list
    .map((q) => ({ ...q, x: q.x + q.vx * dt, y: q.y + q.vy * dt, z: Math.max(0, q.z + q.vz * dt), vz: q.vz - LOOK[q.kind].gravity * dt, age: q.age + dt }))
    .filter((q) => q.age < q.life);
  for (const s of spawns) {
    const look = LOOK[s.kind];
    for (let i = 0; i < look.count; i++) {
      const [a, r1] = draw(rng);
      const [b, r2] = draw(r1);
      rng = r2;
      const way = a * Math.PI * 2;
      list.push({ kind: s.kind, x: s.x, y: s.y, z: s.kind === 'trail' ? 2 : 4, vx: Math.cos(way) * look.speed * b, vy: Math.sin(way) * look.speed * b, vz: look.lift * (0.4 + b), age: 0, life: look.life });
    }
  }
  return { list: list.slice(-MAX_PARTICLES), rng };
}

/** How far behind a boosting kart its trail is born, in world pixels. */
const BEHIND = 8;

/**
 * What a step made happen, as spawns: sparks where the player met a wall, a burst where a racer was hit,
 * a flash where a box was taken (a box that was there and now waits to come back), and a trail behind
 * every racer on BOOST.
 */
export function spawnsOf(before: Race, after: Race, events: readonly RaceEvent[]): Spawn[] {
  const racers = [after.player, ...after.rivals.map((r) => r.kart)];
  const out: Spawn[] = [];
  for (const e of events) {
    const at = 'racer' in e ? racers[e.racer] : undefined;
    if (e.kind === 'wall' && at) out.push({ kind: 'spark', x: at.x, y: at.y });
    if (e.kind === 'hit' && at) out.push({ kind: 'burst', x: at.x, y: at.y });
  }
  after.items.boxes.forEach((box, i) => {
    if (box.back > 0 && (before.items.boxes[i]?.back ?? 0) <= 0) out.push({ kind: 'flash', x: box.x, y: box.y });
  });
  const boosting = [after.fx.boost, ...after.rivals.map((r) => r.fx?.boost ?? 0)];
  racers.forEach((k, i) => {
    if ((boosting[i] ?? 0) > 0) out.push({ kind: 'trail', x: k.x - Math.cos(k.angle) * BEHIND, y: k.y - Math.sin(k.angle) * BEHIND });
  });
  return out;
}
