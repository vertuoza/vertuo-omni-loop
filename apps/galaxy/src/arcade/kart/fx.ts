// The race's particles (PRD 1427, slice 7), pure and seeded like race.ts: a trail behind a kart on BOOST, a burst where an ORB or a BLOB hits, a flash where a box is taken. No DOM and
// no canvas: art.ts draws them. The same seed and the same steps give the same particles, and no more than
// `MAX_PARTICLES` are alive at once: a new one replaces the oldest.
import type { Race, RaceEvent } from './race';
import { RULES } from './rules';
import { draw } from './rivals';
import type { Surface } from './track';

/** PRD 1963: snow off powder, blue then orange sparks of a drift's charge, wind in a slipstream and smoke of a stall join the trail, the burst and the flash. */
export type ParticleKind = 'trail' | 'burst' | 'flash' | 'snow' | 'blue' | 'orange' | 'wind' | 'smoke';

/** A particle: where it is on the floor (x, y) and above it (z), how it moves, and how long it has lived of its life, in seconds. */
export interface Particle { kind: ParticleKind; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number }

/** The particles alive, and the seeded generator the next ones come from. */
export interface Particles { list: readonly Particle[]; rng: number }

/** Something that happened where particles are born. */
export interface Spawn { kind: ParticleKind; x: number; y: number }

export const MAX_PARTICLES = 64;

/** How long each kind lives, how many one spawn makes, how fast they fly (world pixels a second) and how heavy they are. */
export const LOOK: Readonly<Record<ParticleKind, { life: number; count: number; speed: number; lift: number; gravity: number }>> = {
  trail: { life: 0.4, count: 1, speed: 6, lift: 4, gravity: 0 },
  burst: { life: 0.6, count: 10, speed: 90, lift: 50, gravity: 120 },
  flash: { life: 0.3, count: 6, speed: 30, lift: 30, gravity: 0 },
  snow: { life: 0.5, count: 1, speed: 14, lift: 14, gravity: 40 },
  blue: { life: 0.3, count: 1, speed: 25, lift: 20, gravity: 80 },
  orange: { life: 0.3, count: 1, speed: 25, lift: 20, gravity: 80 },
  wind: { life: 0.25, count: 1, speed: 30, lift: 6, gravity: 0 },
  smoke: { life: 0.8, count: 1, speed: 6, lift: 14, gravity: 0 },
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
      list.push({ kind: s.kind, x: s.x, y: s.y, z: s.kind === 'trail' ? 2 : s.kind === 'burst' || s.kind === 'flash' ? 4 : 3, vx: Math.cos(way) * look.speed * b, vy: Math.sin(way) * look.speed * b, vz: look.lift * (0.4 + b), age: 0, life: look.life });
    }
  }
  return { list: list.slice(-MAX_PARTICLES), rng };
}

/** How far behind a kart its trail, snow and smoke are born, in world pixels, and how far from its middle each rear wheel is. */
const BEHIND = 8;
const WHEEL = 3;

/** Where a kart's two rear wheels touch the floor. */
const wheelsOf = (k: { x: number; y: number; angle: number }): [{ x: number; y: number }, { x: number; y: number }] => {
  const bx = k.x - Math.cos(k.angle) * BEHIND, by = k.y - Math.sin(k.angle) * BEHIND;
  const sx = -Math.sin(k.angle) * WHEEL, sy = Math.cos(k.angle) * WHEEL;
  return [{ x: bx + sx, y: by + sy }, { x: bx - sx, y: by - sy }];
};

/** The colour a drift's charge throws: blue from `chargeBlue` seconds, orange from `chargeOrange`, none before. */
export const sparkOf = (charge: number | undefined): 'blue' | 'orange' | undefined =>
  charge === undefined ? undefined : charge >= RULES.chargeOrange ? 'orange' : charge >= RULES.chargeBlue ? 'blue' : undefined;

/** What one racer throws this step: its trail on BOOST, and, on the ground, snow on powder, sparks of a drift's charge and wind in a slipstream. */
function racerSpawns(k: Race['player'], fx: Race['fx'] | undefined, surface: (x: number, y: number) => Surface): Spawn[] {
  const behind = { x: k.x - Math.cos(k.angle) * BEHIND, y: k.y - Math.sin(k.angle) * BEHIND };
  const trail: Spawn[] = (fx?.boost ?? 0) > 0 ? [{ kind: 'trail', ...behind }] : [];
  return fx && fx.fall <= 0 && (fx.hop ?? 0) <= 0 ? [...trail, ...groundSpawns(k, fx, behind, surface)] : trail;
}

/** What a racer on the ground throws: snow on powder, sparks of a drift's charge at its wheels, wind in a slipstream. */
function groundSpawns(k: Race['player'], fx: Race['fx'], behind: { x: number; y: number }, surface: (x: number, y: number) => Surface): Spawn[] {
  const spark = sparkOf(fx.drift === undefined ? undefined : fx.charge);
  return [
    ...(surface(k.x, k.y) === 'powder' && k.speed > RULES.draftMin * RULES.topSpeed ? [{ kind: 'snow' as const, ...behind }] : []),
    ...(spark ? wheelsOf(k).map((w) => ({ kind: spark, ...w })) : []),
    ...((fx.draft ?? 0) > 0 ? [{ kind: 'wind' as const, ...behind }] : []),
  ];
}

/**
 * What a step made happen, as spawns: a burst where a racer was hit, a flash where a box was taken (a box that was there and now waits
 * to come back), a trail behind every racer on BOOST (PRD 1963: and snow behind one fast on powder, sparks at the rear wheels of a drift
 * whose charge is blue or orange, wind behind one building a slipstream, smoke behind the player's stalled engine). `surface` says what is under a point.
 */
export function spawnsOf(before: Race, after: Race, events: readonly RaceEvent[], surface: (x: number, y: number) => Surface = () => 'road'): Spawn[] {
  const racers = [after.player, ...after.rivals.map((r) => r.kart)];
  const out: Spawn[] = [];
  for (const e of events) {
    const at = 'racer' in e ? racers[e.racer] : undefined;
    if (e.kind === 'hit' && at) out.push({ kind: 'burst', x: at.x, y: at.y });
  }
  after.items.boxes.forEach((box, i) => {
    if (box.back > 0 && (before.items.boxes[i]?.back ?? 0) <= 0) out.push({ kind: 'flash', x: box.x, y: box.y });
  });
  const fxs = [after.fx, ...after.rivals.map((r) => r.fx)];
  racers.forEach((k, i) => out.push(...racerSpawns(k, fxs[i], surface)));
  if (after.stall) out.push({ kind: 'smoke', x: after.player.x - Math.cos(after.player.angle) * BEHIND, y: after.player.y - Math.sin(after.player.angle) * BEHIND });
  return out;
}

/** A skid mark on the floor: where it is, how long it has lain, and whether it is white (on ice and powder) or dark (on road). */
export interface Mark { x: number; y: number; age: number; pale: boolean }

export const MAX_MARKS = 96;
/** How long a skid mark lasts before it has faded out, in seconds. */
export const MARK_LIFE = 3;

/** `dt` seconds of the marks: the living age, the faded go, then `born` are laid (the oldest make room past `MAX_MARKS`). */
export function stepMarks(marks: readonly Mark[], born: readonly Omit<Mark, 'age'>[], dt: number): Mark[] {
  const list = marks.map((m) => ({ ...m, age: m.age + dt })).filter((m) => m.age < MARK_LIFE);
  for (const m of born) list.push({ ...m, age: 0 });
  return list.slice(-MAX_MARKS);
}

/** The marks the racers on the ground leave this step: two at the rear wheels of one whose travel is over `RULES.skidGap` radian off its heading, or that drifts. */
export function marksOf(race: Race, surface: (x: number, y: number) => Surface = () => 'road'): Omit<Mark, 'age'>[] {
  const out: Omit<Mark, 'age'>[] = [];
  const all = [{ kart: race.player, fx: race.fx }, ...race.rivals.map((r) => ({ kart: r.kart, fx: r.fx }))];
  for (const { kart, fx } of all) {
    if (!fx || fx.fall > 0 || (fx.hop ?? 0) > 0 || Math.abs(kart.speed) < 1) continue;
    const off = kart.travel === undefined ? 0 : Math.abs(Math.atan2(Math.sin(kart.angle - kart.travel), Math.cos(kart.angle - kart.travel)));
    if (off <= RULES.skidGap && fx.drift === undefined) continue;
    const pale = surface(kart.x, kart.y) !== 'road';
    for (const w of wheelsOf(kart)) out.push({ ...w, pale });
  }
  return out;
}
