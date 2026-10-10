// OMNI KART on the arcade's canvas (PRD 1359): the Omni sky over the circuit in Mode 7, seen from
// behind the player's kart, which is drawn over it with its driver in the seat. The one file under
// arcade/kart/ that draws: everything it draws from is pure (track.ts, mode7.ts, texture.ts, race.ts).
// The circuit's texture is painted once, the first time a race is drawn, and the floor goes through
// one pixel buffer per grid, allocated once and reused. It also holds the race the arcade steps.
import { drawPlanet, drawStarfield, fleetSprite, spriteImage, spriteSize, woundTint } from '@omni/design';
import type { Action } from '../keys';
import { heroOf } from '../fleets';
import { stripesOf } from '../theme';
import { H, nebulaFor, sprite, stars, W, type FrameState } from '../scenes/common.ts';
import { TILE } from './track';
import type { KartCue, KartGame, KartQuit } from '../scenes/kart.ts';
import type { Kart } from './kart';
import { newParticles, spawnsOf, stepParticles, type Particle, type Particles } from './fx';
import { chaseCamera, project, renderFloor, skyShift, spritesInView, viewOf, type Projected, type Texture, type View } from './mode7';
import { cuesOf, hudOf, newRace, pause, press, step, type Race, type RaceEvent } from './race';
import { RULES } from './rules';
import type { Driver, Rival } from './rivals';
import { BEYOND, paintTrack } from './texture';
import { parseTrack, type PropKind, type Track } from './track';

/** A buffer the floor is rendered into, and the canvas it is drawn from. */
interface Floor { image: ImageData; pixels: Uint32Array; canvas: HTMLCanvasElement }

/** The sky's panorama, in screens: a full turn of the camera, for a field of view of 60° across one screen. */
const PANORAMA = 6;

/** A band at the horizon where the floor meets the sky. */
export const HAZE = 5;

const wrap = (x: number, span: number) => ((x % span) + span) % span;

/** A comet in the sky: where its head is, and the way and length of its tail, in screen pixels. */
export interface Comet { x: number; y: number; dir: 1 | -1; tail: number }

/** How many comets the sky holds, how long one takes to cross it, and the share of its period it is in the sky. */
const COMETS = 3;
const CROSSING = 2.4;

/** A small seeded stream of numbers in [0, 1): the same seed, the same numbers. */
function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The comets crossing the sky at time `t`, seeded from the race: each has its own period, its own
 * moment in it, its own height and way, and is in the sky for a short part of its period ("now and
 * then"). With motion reduced they stand still, each caught half way across.
 */
export function cometsOf(seed: number, t: number, w: number, sky: number, reduced: boolean): Comet[] {
  const next = stream(seed ^ 0x636f6d);
  const out: Comet[] = [];
  for (let i = 0; i < COMETS; i++) {
    const period = 7 + next() * 8, offset = next() * period, y = Math.floor(6 + next() * Math.max(1, sky * 0.6)), dir = next() < 0.5 ? -1 : 1;
    const tail = Math.round(10 + next() * 14);
    const into = reduced ? CROSSING / 2 : wrap(t + offset, period);
    if (into >= CROSSING) continue;
    const along = into / CROSSING;
    out.push({ x: Math.round((dir === 1 ? along : 1 - along) * (w + tail * 2) - tail), y: Math.min(y, sky - 1), dir: dir === 1 ? 1 : -1, tail });
  }
  return out;
}

/** The planet's seed, and the second planet's. */
const PLANET_SEED = 1359;
const MOON_SEED = 1427;

function skyOf(ctx: CanvasRenderingContext2D, s: FrameState, v: View, seed: number) {
  const sky = v.horizon;
  const shift = s.reduced ? 0 : skyShift(v.angle, v.w * PANORAMA);
  const bands = [s.theme.void, '#0a0824', '#0d0a2c', '#110c34'];
  bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, Math.floor((sky / bands.length) * i), v.w, Math.ceil(sky / bands.length)); });
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, v.w, sky);
  ctx.clip();
  // The stars scroll with the camera, the nearer layers faster; the nebula and the planet stand in the panorama.
  drawStarfield(ctx, stars, shift / 6, { w: W, h: H, speed: 1 });
  ctx.drawImage(nebulaFor('kart-sky', 1, 360, 150), Math.round(wrap(shift * 0.5 + 40, v.w * 3) - v.w * 0.5 - 20), Math.round(sky - 130));
  drawPlanet(ctx, {
    cx: Math.round(wrap(shift + v.w * 0.7, v.w * PANORAMA) - v.w * 0.2), cy: sky - 20, r: Math.round(sky * 0.28), seed: PLANET_SEED,
    rot: s.reduced ? 0 : s.t * 0.05, progress: 0.6, mood: 'alive', atmosphere: s.theme.cyan,
  });
  // A second, smaller planet far from the first, and the station farther still: both stand in the panorama too.
  drawPlanet(ctx, {
    cx: Math.round(wrap(shift * 0.8 + v.w * 0.15, v.w * PANORAMA) - v.w * 0.1), cy: Math.round(sky * 0.45), r: Math.round(sky * 0.12), seed: MOON_SEED,
    rot: s.reduced ? 0 : s.t * 0.03, progress: 0.3, mood: 'alive', atmosphere: s.theme.gold,
  });
  sprite(ctx, s, 'sky-station', Math.round(wrap(shift * 0.6 + v.w * 0.45, v.w * PANORAMA) - v.w * 0.1), Math.round(sky * 0.3), { frame: s.reduced ? 0 : Math.floor(s.t * 1.5) % 2 });
  for (const c of cometsOf(seed, s.t, v.w, sky, s.reduced)) {
    for (let i = 0; i < c.tail; i += 2) {
      ctx.globalAlpha = 1 - i / c.tail;
      ctx.fillStyle = i === 0 ? s.theme.white : s.theme.cyan;
      ctx.fillRect(c.x - c.dir * i, c.y, 2, 1);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = s.theme['plasma-dark'];
  ctx.fillRect(0, sky - HAZE, v.w, HAZE);
  ctx.globalAlpha = 1;
}

/** A shadow on the floor: a dark ellipse `w` wide centred at (cx, cy), drawn as three rows. Every kart casts one, drawn before the kart. */
export const SHADOW = 'rgba(8, 6, 24, 0.45)';
function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const row = Math.max(1, Math.round(w * 0.07));
  ctx.fillStyle = SHADOW;
  for (const [i, share] of ([[-1, 0.7], [0, 1], [1, 0.7]] as const)) {
    const rw = Math.round(w * share);
    ctx.fillRect(Math.round(cx - rw / 2), Math.round(cy + i * row), rw, row);
  }
}

/** The kart's art, in sprite pixels: its sprite's size, where the driver's shoulders meet the seat, and how much of the hero sits above it. */
export const KART_W = 28;
export const SEAT = 8;
export const DRIVER_ROWS = 26;
export const DRIVER_W = 32;

/** The kart's sprite for the way it is steered: leaning into the turn. */
const viewOfKart = (k: Kart): string => (k.steer < 0 ? 'kart-left' : k.steer > 0 ? 'kart-right' : 'kart');

/** The views a spinning kart turns through: it shows its sides and its back as it goes round. */
const SPIN_VIEWS = ['kart', 'kart-right', 'kart', 'kart-left'] as const;

/**
 * The player's kart, seen from behind at the bottom of the screen, tinted with the hero's suit, and
 * the hero in its seat (head and shoulders, half the kart's scale). The wheels' tread turns with the
 * speed.
 */
function playerKart(ctx: CanvasRenderingContext2D, s: FrameState, race: Race) {
  const scale = s.grid.w >= W ? 4 : 2;
  const look = heroOf(s.join.hero, s.join.team);
  const kart = race.player;
  const frame = s.reduced ? 0 : Math.floor(race.clock * Math.abs(kart.speed) * 0.12) % 2;
  const x = Math.round((s.grid.w - KART_W * scale) / 2), y = s.grid.h - 18 * scale - 6;
  const half = scale / 2;
  shadow(ctx, x + (KART_W * scale) / 2, y + 16 * scale, KART_W * scale * 1.05);
  const driver = spriteImage(look.sprite, { tint: look.tint, flat: stripesOf(s.theme), frame });
  const lean = kart.steer * half;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(driver, 0, 0, DRIVER_W, DRIVER_ROWS, Math.round(x + (KART_W * scale - DRIVER_W * half) / 2 + lean), Math.round(y + SEAT * scale - DRIVER_ROWS * half), DRIVER_W * half, DRIVER_ROWS * half);
  const spin = race.fx.spin > 0 ? SPIN_VIEWS[Math.floor(s.t * 12) % SPIN_VIEWS.length] : undefined;
  sprite(ctx, s, spin ?? viewOfKart(kart), x, y, { scale, tint: look.tint, frame });
}

/** How wide a kart stands in the world, in game pixels: a rival is drawn this wide, scaled by its distance. */
export const KART_WORLD = 14;

/** The kart's sprite for the way a rival faces, seen from the camera: the view closest to the angle it is seen from (the sprite is drawn from behind, leaning left or right). */
export function viewFacing(rival: number, camera: number): string {
  const rel = Math.atan2(Math.sin(rival - camera), Math.cos(rival - camera));
  return rel < -LEAN ? 'kart-left' : rel > LEAN ? 'kart-right' : 'kart';
}
const LEAN = 0.3;

/** A rival's kart on the floor at `at`, its driver in the seat, as big as its distance makes it. */
function rivalKart(ctx: CanvasRenderingContext2D, s: FrameState, v: View, r: Rival, at: Projected) {
  const scale = (KART_WORLD * at.scale) / KART_W;
  if (scale < 0.15) return;
  const frame = s.reduced ? 0 : Math.floor(s.t * Math.abs(r.kart.speed) * 0.12) % 2;
  const flat = stripesOf(s.theme);
  const body = spriteImage(viewFacing(r.kart.angle, v.angle), { tint: fleetSprite(null, r.driver.color).tint, flat, frame });
  const driver = spriteImage(r.driver.sprite, { tint: r.driver.tint, flat, frame });
  const x = at.sx - (KART_W * scale) / 2, y = at.sy - 18 * scale;
  const half = scale / 2;
  shadow(ctx, at.sx, at.sy - 2 * scale, KART_W * scale * 1.05);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(driver, 0, 0, DRIVER_W, DRIVER_ROWS, Math.round(x + (KART_W * scale - DRIVER_W * half) / 2), Math.round(y + SEAT * scale - DRIVER_ROWS * half), DRIVER_W * half, DRIVER_ROWS * half);
  ctx.drawImage(body, Math.round(x), Math.round(y), KART_W * scale, 18 * scale);
}

/** What stands on the floor besides the karts: an item box, a BLOB, an ORB in flight. */
type Thing = { x: number; y: number } & (
  { kind: 'rival'; rival: Rival } | { kind: 'box' } | { kind: 'blob' } | { kind: 'orb' }
  | { kind: 'prop'; prop: PropKind } | { kind: 'arch'; leg: 0 | 1 }
);

/** A prop's sprite, and how wide it stands in the world, in game pixels: it is drawn this wide, scaled by its distance. */
export const PROP_ART: Readonly<Record<PropKind, { sprite: string; world: number }>> = {
  pylon: { sprite: 'prop-pylon', world: 12 },
  beacon: { sprite: 'prop-beacon', world: 12 },
  asteroid: { sprite: 'prop-asteroid', world: 26 },
  satellite: { sprite: 'prop-satellite', world: 26 },
  wreck: { sprite: 'prop-wreck', world: 30 },
};

/** The arch's leg and beam, and how wide a leg stands in the world. */
const ARCH_LEG = 'arch-leg';
const ARCH_BEAM = 'arch-beam';
export const ARCH_WORLD = 10;

/** The frame a prop shows: a beacon blinks and a satellite turns, and both stand still when motion is reduced. */
export const propFrame = (kind: PropKind, s: FrameState): number =>
  s.reduced ? 0 : kind === 'beacon' ? Math.floor(s.t * 2) % 2 : kind === 'satellite' ? Math.floor(s.t * 1.2) % 2 : 0;

/** A prop standing on its wall tile, as big as its distance makes it. */
function propSprite(ctx: CanvasRenderingContext2D, s: FrameState, at: Projected, kind: PropKind) {
  const art = PROP_ART[kind];
  const { w, h } = spriteSize(art.sprite);
  const scale = (art.world * at.scale) / w;
  if (w * scale < 2) return;
  ctx.imageSmoothingEnabled = false;
  sprite(ctx, s, art.sprite, at.sx - (w * scale) / 2, at.sy - h * scale, { scale, frame: propFrame(kind, s) });
}

/**
 * One leg of the arch over the start line, and, with the first, the beam between the two legs when
 * both are in front of the camera. The beam is the leg's sprite stretched across the road.
 */
function archLeg(ctx: CanvasRenderingContext2D, s: FrameState, v: View, track: Track, leg: 0 | 1, at: Projected) {
  const { w, h } = spriteSize(ARCH_LEG);
  const scale = (ARCH_WORLD * at.scale) / w;
  if (w * scale < 1) return;
  ctx.imageSmoothingEnabled = false;
  const top = at.sy - h * scale;
  const other = track.arch[leg === 0 ? 1 : 0];
  const beyond = project(v, other.x, other.y);
  if (leg === 0 && beyond) {
    const beam = spriteSize(ARCH_BEAM);
    const left = Math.min(at.sx, beyond.sx), right = Math.max(at.sx, beyond.sx);
    const bh = Math.max(1, beam.h * scale), y = Math.min(top, beyond.sy - h * ((ARCH_WORLD * beyond.scale) / w));
    ctx.save();
    ctx.translate(left, y);
    ctx.scale(Math.max(0, right - left) / beam.w, bh / beam.h);
    sprite(ctx, s, ARCH_BEAM, 0, 0, { frame: s.reduced ? 0 : Math.floor(s.t * 3) % 2 });
    ctx.restore();
  }
  sprite(ctx, s, ARCH_LEG, at.sx - (w * scale) / 2, top, { scale });
}

/** How wide an item stands in the world, in game pixels. */
export const BOX_WORLD = 16;
const BLOB_WORLD = 12;
const ORB_WORLD = 9;

/** An item box on the floor: a glowing cube that turns and bobs, as big as its distance makes it; still when motion is reduced. */
const BOX = 'item-box';
export const boxFrame = (s: FrameState, z: number): number => (s.reduced ? 0 : Math.floor(s.t * 3 + z * 0.01) % 2);
function itemBox(ctx: CanvasRenderingContext2D, s: FrameState, at: Projected) {
  const { w, h } = spriteSize(BOX);
  const scale = (BOX_WORLD * at.scale) / w;
  if (w * scale < 2) return;
  const bob = s.reduced ? 0 : Math.sin(s.t * 4 + at.z * 0.05) * h * scale * 0.08;
  ctx.imageSmoothingEnabled = false;
  sprite(ctx, s, BOX, at.sx - (w * scale) / 2, at.sy - h * scale + bob - h * scale * 0.1, { scale, frame: boxFrame(s, at.z) });
}

/** A BLOB lying on the road, or an ORB in flight (a little above it): a sprite as wide as its distance makes it. */
function thrownItem(ctx: CanvasRenderingContext2D, s: FrameState, at: Projected, name: 'entropy' | 'orb') {
  const world = name === 'orb' ? ORB_WORLD : BLOB_WORLD;
  const size = world * at.scale;
  if (size < 2) return;
  const frame = s.reduced ? 0 : Math.floor(s.t * 6) % 2;
  const image = spriteImage(name, { ...(name === 'entropy' ? { tint: woundTint('fault-line') } : {}), flat: stripesOf(s.theme), frame });
  const lift = name === 'orb' ? size * 0.6 : 0;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.round(at.sx - size / 2), Math.round(at.sy - size - lift), Math.round(size), Math.round(size));
}

/** How a particle looks: its colour (a theme token, so it follows the theme) and its size in world pixels. */
const PARTICLE: Readonly<Record<Particle['kind'], { token: 'yellow' | 'white' | 'cyan' | 'gold'; size: number }>> = {
  spark: { token: 'yellow', size: 1.6 }, trail: { token: 'cyan', size: 2.4 }, burst: { token: 'gold', size: 2.4 }, flash: { token: 'white', size: 3 },
};

/** The particles on the floor, near ones over far ones, each fading as it ages. None is drawn when motion is reduced: a frozen spark is noise. */
function particlesOn(ctx: CanvasRenderingContext2D, s: FrameState, v: View, particles: Particles) {
  if (s.reduced) return;
  const seen = spritesInView(v, particles.list);
  for (const { sprite: p, at } of seen) {
    const look = PARTICLE[p.kind];
    const size = Math.max(1, Math.round(look.size * at.scale));
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = s.theme[look.token];
    ctx.fillRect(Math.round(at.sx - size / 2), Math.round(at.sy - p.z * at.scale - size / 2), size, size);
  }
  ctx.globalAlpha = 1;
}

/** What `createKart` needs: the race's seed, and the rivals' drivers (the workspace's fleets). */
export interface KartOptions { seed: number; cast?: readonly Driver[] }

/** The race as the arcade drives and draws it: the circuit loaded, the camera behind the player's kart. */
export function createKart({ seed, cast = [] }: KartOptions = { seed: 1359 }): KartGame {
  const track: Track = parseTrack();
  let race = newRace({ seed, track, cast });
  let texture: Texture | null = null;
  let particles = newParticles(seed);
  const floors = new Map<string, Floor>();
  const floorFor = (v: View): Floor => {
    const key = `${v.w}x${v.h}`;
    let floor = floors.get(key);
    if (!floor) {
      const canvas = document.createElement('canvas');
      canvas.width = v.w;
      canvas.height = v.h;
      const image = new ImageData(v.w, v.h);
      floor = { image, pixels: new Uint32Array(image.data.buffer), canvas };
      floors.set(key, floor);
    }
    return floor;
  };

  // What happened since the arcade last asked: the race's events, as cues, in order.
  let told: KartCue[] = [];
  /** How far racer `i` stands from the player, in tiles. */
  const tilesTo = (i: number): number => {
    const rival = race.rivals[i - 1];
    return i === 0 || !rival ? 0 : Math.hypot(rival.kart.x - race.player.x, rival.kart.y - race.player.y) / TILE;
  };
  const tell = (events: readonly RaceEvent[]) => {
    for (const e of events) told.push(...cuesOf(e, 'racer' in e ? tilesTo(e.racer) : 0));
  };

  return {
    step(held: ReadonlySet<Action>, dt: number): number | null {
      const before = race;
      const r = step(race, held, dt);
      race = r.race;
      if (before.phase === 'race') particles = stepParticles(particles, spawnsOf(before, race, r.events), dt);
      tell(r.events);
      const done = r.events.find((e) => e.kind === 'finish');
      return done?.kind === 'finish' ? done.tenths : null;
    },
    press(action: Action): KartQuit {
      const r = press(race, action);
      race = r.race;
      tell(r.events);
      return { quit: r.events.some((e) => e.kind === 'quit'), again: r.events.some((e) => e.kind === 'again') };
    },
    pause() { race = pause(race); },
    cues() { const out = told; told = []; return out; },
    speed: () => Math.min(1, Math.max(0, race.player.speed / RULES.topSpeed)),
    hud: () => hudOf(race),
    draw(ctx, s) {
      texture ??= paintTrack(track);
      const v = viewOf(s.grid, chaseCamera(race.player));
      skyOf(ctx, s, v, seed);
      const floor = floorFor(v);
      renderFloor(v, texture, floor.pixels, BEYOND);
      floor.canvas.getContext('2d')?.putImageData(floor.image, 0, 0);
      ctx.drawImage(floor.canvas, 0, 0);
      const things: Thing[] = [
        ...race.items.boxes.filter((b) => b.back <= 0).map((b): Thing => ({ kind: 'box', x: b.x, y: b.y })),
        ...race.items.blobs.map((b): Thing => ({ kind: 'blob', x: b.x, y: b.y })),
        ...race.items.orbs.map((o): Thing => ({ kind: 'orb', x: o.x, y: o.y })),
        ...race.rivals.map((rival): Thing => ({ kind: 'rival', rival, x: rival.kart.x, y: rival.kart.y })),
        ...track.props.map(({ kind, x, y }): Thing => ({ kind: 'prop', prop: kind, x, y })),
        ...track.arch.map(({ x, y }, leg): Thing => ({ kind: 'arch', leg: leg === 0 ? 0 : 1, x, y })),
      ];
      // The farthest first, so a near kart covers a far item.
      for (const { sprite: thing, at } of spritesInView(v, things)) {
        if (thing.kind === 'rival') rivalKart(ctx, s, v, thing.rival, at);
        else if (thing.kind === 'box') itemBox(ctx, s, at);
        else if (thing.kind === 'prop') propSprite(ctx, s, at, thing.prop);
        else if (thing.kind === 'arch') archLeg(ctx, s, v, track, thing.leg, at);
        else thrownItem(ctx, s, at, thing.kind === 'blob' ? 'entropy' : 'orb');
      }
      particlesOn(ctx, s, v, particles);
      playerKart(ctx, s, race);
    },
  };
}
