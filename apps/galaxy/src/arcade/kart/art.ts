// OMNI KART on the arcade's canvas (PRD 1359): the Omni sky over the circuit in Mode 7, seen from
// behind the player's kart, which is drawn over it with its driver in the seat. The one file under
// arcade/kart/ that draws: everything it draws from is pure (track.ts, mode7.ts, texture.ts, race.ts).
// The circuit's texture and the ground's heights are painted once, the first time a race is drawn, and the
// floor goes through one pixel buffer per grid, allocated once and reused. The road rises and falls
// (relief.ts, PRD 1698): the camera rides the ground under the player's kart, a sprite stands on the ground
// under it, and a hill's crest hides what is behind it. It also holds the race the arcade steps.
import { drawPlanet, drawStarfield, fleetSprite, spriteImage, spriteSize, woundTint, type Tint } from '@omni/design';
import type { Action } from '../keys';
import { heroOf } from '../fleets';
import { stripesOf } from '../theme';
import { H, nebulaFor, sprite, stars, W, type FrameState } from '../scenes/common.ts';
import { TILE } from './track';
import type { KartCue, KartGame, KartQuit } from '../scenes/kart.ts';
import { leanOf, NO_FX, type Kart } from './kart';
import { newParticles, spawnsOf, stepParticles, type Particle, type Particles } from './fx';
import { chaseCamera, depthAt, project, renderTerrain, skyShift, spritesInView, viewOf, type Deck, type Projected, type Texture, type View } from './mode7';
import { groundAt, heightsOf, reliefRange } from './relief';
import type { GridSession, RaceStart } from './hub';
import type { Item } from './items';
import { rateFor, readMessage, type GridPlayer, type ItemMessage, type RaceMessage } from './net';
import { away, cuesOf, dropOut, finishOf, hear, hudOf, lift, newRace, pause, plant, press, step, whereIs, type Race, type RaceEvent } from './race';
import { RULES, type Difficulty } from './rules';
import { COLORS, DEFAULT_LOOK, kartSprite, kartTint, type KartLook, type KartView } from './look';
import type { Driver, Rival } from './rivals';
import { deckOf, paintTrack } from './texture';
import { isRoad, parseTrack, tileAt, type PropKind, type Track } from './track';

/** A buffer the floor is rendered into, how far each of its pixels is (Infinity where it shows no road), and the canvas it is drawn from. */
interface Floor { image: ImageData; pixels: Uint32Array; depth: Float32Array; canvas: HTMLCanvasElement }

/** The circuit's ground, once painted: its texture, the height under each of its pixels, the lowest and highest of them, and the side of its deck. */
interface Ground { texture: Texture; heights: Float32Array; range: { low: number; high: number }; deck: Deck }

/**
 * Where the part of a sprite `z` away, in the screen box `box`, is covered by nearer road: for each column of the box,
 * the first row from the top where the floor is nearer than it (the box's bottom where none is), or null when no column
 * is covered. What a crest hides is what is under the row it covers from.
 */
export function coverOf(depth: Float32Array, w: number, h: number, box: { left: number; top: number; right: number; bottom: number }, z: number): Int16Array | null {
  const left = Math.max(0, Math.floor(box.left)), right = Math.min(w, Math.ceil(box.right));
  const top = Math.max(0, Math.floor(box.top)), bottom = Math.min(h, Math.ceil(box.bottom));
  if (left >= right || top >= bottom) return null;
  const nearer = z * 0.9 - 2; // one row of the floor is up to 2.5% of a far thing's distance, and the foot's two rows below it count
  const cut = new Int16Array(right - left);
  let any = false;
  for (let col = left; col < right; col++) {
    let row = top;
    while (row < bottom && (depth[row * w + col] ?? Infinity) >= nearer) row++;
    cut[col - left] = row;
    if (row < bottom) any = true;
  }
  return any ? cut : null;
}

/**
 * Clips what is drawn next to the part of a sprite that no nearer road covers (`coverOf`). Saves the context when it
 * clips and says so, for the caller to restore it; clips nothing when no road covers the box.
 */
function hideBehind(ctx: CanvasRenderingContext2D, floor: Floor, w: number, h: number, box: { left: number; top: number; right: number; bottom: number }, z: number): boolean {
  const cut = coverOf(floor.depth, w, h, box, z);
  if (!cut) return false;
  const left = Math.max(0, Math.floor(box.left)), top = Math.max(0, Math.floor(box.top));
  ctx.save();
  ctx.beginPath();
  for (let start = 0, col = 1; col <= cut.length; col++) {
    const at = cut[start] ?? top;
    if (col < cut.length && cut[col] === at) continue;
    if (at > top) ctx.rect(left + start, top, col - start, at - top);
    start = col;
  }
  ctx.clip();
  return true;
}

/** The sky's panorama, in screens: a full turn of the camera, for a field of view of 60° across one screen. */
const PANORAMA = 6;

/** The galaxy's disc along the horizon: a glow this many rows deep on each side of it, fading away from it. */
export const HAZE = 6;

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

/**
 * The space the circuit floats in (PRD 1447), all round it: above the horizon, and under it, where the floor
 * is see-through over the void. Its bands brighten towards the horizon from both sides, the stars and the
 * nebulae fill both halves, and the planets stand across the horizon, not cut by it.
 */
function skyOf(ctx: CanvasRenderingContext2D, s: FrameState, v: View, seed: number) {
  const sky = v.horizon, under = v.h - sky;
  const shift = s.reduced ? 0 : skyShift(v.angle, v.w * PANORAMA);
  const bands = [s.theme.void, '#0a0824', '#0d0a2c', '#110c34'];
  bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, Math.floor((sky / bands.length) * i), v.w, Math.ceil(sky / bands.length)); });
  [...bands].reverse().forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, sky + Math.floor((under / bands.length) * i), v.w, Math.ceil(under / bands.length)); });
  // The stars scroll with the camera, the nearer layers faster; the nebulae and the planets stand in the panorama.
  drawStarfield(ctx, stars, shift / 6, { w: W, h: H, speed: 1 });
  ctx.drawImage(nebulaFor('kart-sky', 1, 360, 150), Math.round(wrap(shift * 0.5 + 40, v.w * 3) - v.w * 0.5 - 20), Math.round(sky - 130));
  ctx.drawImage(nebulaFor('kart-deep', 2, 420, 160), Math.round(wrap(shift * 0.5 + v.w * 1.6, v.w * 3) - v.w * 0.5 - 20), Math.round(sky + under * 0.15));
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
  // The galaxy's disc seen edge on: a glow along the horizon, brightest on it and fading above and below.
  ctx.fillStyle = s.theme['plasma-dark'];
  for (let i = 0; i < HAZE; i++) {
    ctx.globalAlpha = 0.5 * (1 - i / HAZE);
    ctx.fillRect(0, sky - 1 - i, v.w, 1);
    ctx.fillRect(0, sky + i, v.w, 1);
  }
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
/** How far above the screen's bottom the player's kart stands: the camera sits so the floor under its centre is on that row, where its wheels touch, as a rival's do. */
const KART_FOOT = 6;

/** The camera behind the player's kart on `grid`: as far back as puts the floor under the kart's centre where its sprite's wheels touch, so it is drawn where it stands. */
export const cameraFor = (grid: { w: number; h: number }, kart: Kart): { x: number; y: number; angle: number } => chaseCamera(kart, depthAt(grid, grid.h - KART_FOOT));

/** The camera's view of the race on `grid`: behind the player's kart, its eye 28 over the ground under it. */
export const viewFor = (grid: { w: number; h: number }, track: Pick<Track, 'waypoints' | 'relief'>, kart: Kart): View => viewOf(grid, cameraFor(grid, kart), groundAt(track, kart.x, kart.y));

/** The kart's sprite for the way it is steered: leaning into the turn. */
const viewOfKart = (k: Kart): KartView => (k.steer < 0 ? 'kart-left' : k.steer > 0 ? 'kart-right' : 'kart');

/** How far a kart's fall has gone, 0 (just over the edge) to 1 (gone): it is drawn smaller and lower as it grows. */
export const fallenOf = (fx: { fall: number }): number => (fx.fall > 0 ? 1 - Math.min(1, fx.fall / RULES.fallTime) : 0);

/** How far a kart rolls over, in radians: a little for a lean (`lean` is -1 to 1, as `leanOf` gives it) and, once it tips, more and more as it falls, onto its side. Towards the side over the void: clockwise (positive) for its right. */
const TILT = 0.5;
const ROLL = 1.3;
export function rollOf(lean: number, fallen: number): number {
  return lean === 0 ? 0 : Math.sign(lean) * Math.min(Math.PI / 2, TILT * Math.min(0.5, Math.abs(lean)) + ROLL * fallen);
}

/** Draws `draw` turned by `roll` about the screen point x, y (where the kart's wheels touch the road). */
function rolled(ctx: CanvasRenderingContext2D, roll: number, x: number, y: number, draw: () => void) {
  if (roll === 0) { draw(); return; }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(roll);
  ctx.translate(-x, -y);
  draw();
  ctx.restore();
}

/** How fast a kart blinks once it is back on the road, in blinks a second: it is drawn on every other frame of the blink. */
const BLINK_RATE = 12;
/** Whether a blinking kart is hidden in this frame; a kart that is not blinking never is. */
export const hiddenBlink = (fx: { blink: number }): boolean => fx.blink > 0 && Math.floor(fx.blink * BLINK_RATE) % 2 === 1;

/** The views a spinning kart turns through: it shows its sides and its back as it goes round. */
const SPIN_VIEWS = ['kart', 'kart-right', 'kart', 'kart-left'] as const;

/**
 * The player's kart, seen from behind at the bottom of the screen, tinted with the hero's suit, and
 * the hero in its seat (head and shoulders, half the kart's scale). The wheels' tread turns with the
 * speed.
 */
function playerKart(ctx: CanvasRenderingContext2D, s: FrameState, race: Race) {
  const fallen = fallenOf(race.fx);
  if (fallen >= 1 || hiddenBlink(race.fx)) return;
  const scale = (s.grid.w >= W ? 4 : 2) * (1 - fallen);
  const look = heroOf(s.join.hero, s.join.team);
  const kart = race.player;
  const frame = s.reduced ? 0 : Math.floor(race.clock * Math.abs(kart.speed) * 0.12) % 2;
  const x = Math.round((s.grid.w - KART_W * scale) / 2), y = s.grid.h - 18 * scale - KART_FOOT + fallen * 18 * scale;
  const half = scale / 2;
  if (race.fx.fall <= 0) shadow(ctx, x + (KART_W * scale) / 2, y + 16 * scale, KART_W * scale * 1.05); // a falling kart casts none
  const driver = spriteImage(look.sprite, { tint: look.tint, flat: stripesOf(s.theme), frame });
  const lean = kart.steer * half;
  const roll = rollOf(leanOf(race.track.map, kart), fallen);
  rolled(ctx, roll, x + (KART_W * scale) / 2, y + 18 * scale, () => {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(driver, 0, 0, DRIVER_W, DRIVER_ROWS, Math.round(x + (KART_W * scale - DRIVER_W * half) / 2 + lean), Math.round(y + SEAT * scale - DRIVER_ROWS * half), DRIVER_W * half, DRIVER_ROWS * half);
    const spin = race.fx.spin > 0 ? SPIN_VIEWS[Math.floor(s.t * 12) % SPIN_VIEWS.length] : undefined;
    sprite(ctx, s, kartSprite(race.look ?? DEFAULT_LOOK, spin ?? viewOfKart(kart)), x, y, { scale, tint: kartTint(race.look ?? DEFAULT_LOOK, look.tint), frame });
  });
}

/** How wide a kart stands in the world, in game pixels: a rival is drawn this wide, scaled by its distance. A kart falls once all of it is past the road's edge (`RULES.overhang`, half of it). */
export const KART_WORLD = 14;

/** The kart's sprite for the way a rival faces, seen from the camera: the view closest to the angle it is seen from (the sprite is drawn from behind, leaning left or right). */
export function viewFacing(rival: number, camera: number): KartView {
  const rel = Math.atan2(Math.sin(rival - camera), Math.cos(rival - camera));
  return rel < -LEAN ? 'kart-left' : rel > LEAN ? 'kart-right' : 'kart';
}
const LEAN = 0.3;

/** A rival's kart on the floor at `at`, its driver in the seat, as big as its distance makes it. */
function rivalKart(ctx: CanvasRenderingContext2D, s: FrameState, v: View, r: Rival, at: Projected, lean: number) {
  const fallen = fallenOf(r.fx ?? NO_FX);
  if (fallen >= 1 || hiddenBlink(r.fx ?? NO_FX)) return;
  const scale = ((KART_WORLD * at.scale) / KART_W) * (1 - fallen);
  if (scale < 0.15) return;
  const frame = s.reduced ? 0 : Math.floor(s.t * Math.abs(r.kart.speed) * 0.12) % 2;
  const flat = stripesOf(s.theme);
  const body = spriteImage(...bodyOf(r.driver, viewFacing(r.kart.angle, v.angle), flat, frame));
  const driver = spriteImage(r.driver.sprite, { tint: r.driver.tint, flat, frame });
  const x = at.sx - (KART_W * scale) / 2, y = at.sy - 18 * scale + fallen * 6 * at.scale;
  const half = scale / 2;
  if ((r.fx ?? NO_FX).fall <= 0) shadow(ctx, at.sx, at.sy - 2 * scale, KART_W * scale * 1.05); // a falling kart casts none
  rolled(ctx, rollOf(lean, fallen), at.sx, y + 18 * scale, () => {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(driver, 0, 0, DRIVER_W, DRIVER_ROWS, Math.round(x + (KART_W * scale - DRIVER_W * half) / 2), Math.round(y + SEAT * scale - DRIVER_ROWS * half), DRIVER_W * half, DRIVER_ROWS * half);
    ctx.drawImage(body, Math.round(x), Math.round(y), KART_W * scale, 18 * scale);
  });
}

/** What stands on the floor besides the karts: an item box, a BLOB, an ORB in flight. `g` is the ground's height under it. */
type Thing = { x: number; y: number; g: number } & (
  { kind: 'rival'; rival: Rival } | { kind: 'box' } | { kind: 'blob' } | { kind: 'orb' }
  | { kind: 'prop'; prop: PropKind } | { kind: 'arch'; leg: 0 | 1 }
);

/** Where the minimap stands (PRD 1698): this far in from the right edge, and under the item panel of the race's line (its top at 8, about 24 high). */
const MINIMAP_INSET = 8;
export const MINIMAP_TOP = 36;
const FRAME = 1;
const MINIMAP_PANEL = 'rgba(11, 10, 38, 0.82)';

/** The minimap's frame on a grid, and where its first tile is: one game pixel a tile, inside a frame of one. */
export function minimapAt(grid: { w: number }, track: Pick<Track, 'cols' | 'rows'>): { x: number; y: number; w: number; h: number; mapX: number; mapY: number } {
  const w = track.cols + 2 * FRAME, h = track.rows + 2 * FRAME;
  const x = grid.w - MINIMAP_INSET - w;
  return { x, y: MINIMAP_TOP, w, h, mapX: x + FRAME, mapY: MINIMAP_TOP + FRAME };
}

interface MinimapTile { x: number; y: number; colour: string }

/** The road's tiles seen from above, each with its colour: the higher the ground, the lighter, the start line white. Measured once per circuit. */
export function minimapTiles(track: Track, range: { low: number; high: number }): MinimapTile[] {
  const out: MinimapTile[] = [];
  const span = range.high - range.low;
  for (let y = 0; y < track.rows; y++) {
    for (let x = 0; x < track.cols; x++) {
      const c = tileAt(track.map, x, y);
      if (!isRoad(c)) continue;
      if (c === 'S') { out.push({ x, y, colour: '#ffffff' }); continue; }
      const t = span > 0 ? (groundAt(track, (x + 0.5) * TILE, (y + 0.5) * TILE) - range.low) / span : 0;
      const k = Math.round(70 + 120 * Math.min(1, Math.max(0, t)));
      out.push({ x, y, colour: `rgb(${k}, ${k + 20}, ${Math.min(255, k + 60)})` });
    }
  }
  return out;
}

/** Whether the player's dot is lit this frame: always, but while the player falls it blinks, and with reduced motion it does not. */
export const minimapLit = (s: { t: number; reduced: boolean }, fx: { fall: number }): boolean => s.reduced || fx.fall <= 0 || Math.floor(s.t * 6) % 2 === 0;

/** The circuit from above in the top right corner: the road by height, the boxes to take, a dot per kart on the road, the player's dot last. */
function minimap(ctx: CanvasRenderingContext2D, s: FrameState, track: Track, tiles: readonly MinimapTile[], race: Race) {
  const at = minimapAt(s.grid, track);
  ctx.fillStyle = s.theme.cyan;
  ctx.fillRect(at.x, at.y, at.w, at.h);
  ctx.fillStyle = MINIMAP_PANEL;
  ctx.fillRect(at.x + FRAME, at.y + FRAME, at.w - 2 * FRAME, at.h - 2 * FRAME);
  for (const t of tiles) { ctx.fillStyle = t.colour; ctx.fillRect(at.mapX + t.x, at.mapY + t.y, 1, 1); }
  minimapDots(ctx, s, at, race);
}

/** The tint a kart's body wears: the fleet's own (or none) for FLEET, else the look's colour over it. */
const lookTint = (look: KartLook | undefined, fleet: Tint | null): Tint | null => (look && look.color !== 'FLEET' ? kartTint(look, fleet ?? {}) : fleet);

/** What a driver's kart body is drawn with: its look's design in the view, and its colour over the fleet's. */
const bodyOf = (driver: Driver, view: KartView, flat: ReturnType<typeof stripesOf>, frame: number) =>
  [kartSprite(driver.look ?? DEFAULT_LOOK, view), { tint: lookTint(driver.look, fleetSprite(null, driver.color).tint), flat, frame }] as const;

/** A kart's dot on the minimap: its look's colour when it has one that is not FLEET, else the fleet's colour (`fallback`). */
export const dotColour = (look: KartLook | undefined, fallback: string): string => COLORS.find((c) => c.name === look?.color)?.hex ?? fallback;

/** The boxes to take, the karts on the road (none for one that falls), then the player, last. */
function minimapDots(ctx: CanvasRenderingContext2D, s: FrameState, at: { mapX: number; mapY: number }, race: Race) {
  const tile = (v: number, o: number) => o + Math.floor(v / TILE);
  ctx.fillStyle = s.theme.gold;
  for (const b of race.items.boxes.filter((x) => x.back <= 0)) ctx.fillRect(tile(b.x, at.mapX), tile(b.y, at.mapY), 1, 1);
  for (const r of race.rivals.filter((x) => (x.fx?.fall ?? 0) <= 0)) {
    ctx.fillStyle = dotColour(r.driver.look, r.driver.color ?? s.theme.white);
    ctx.fillRect(tile(r.kart.x, at.mapX) - 1, tile(r.kart.y, at.mapY) - 1, 2, 2);
  }
  if (!minimapLit(s, race.fx)) return;
  const { x, y, angle } = race.player;
  ctx.fillStyle = s.theme.yellow;
  ctx.fillRect(tile(x, at.mapX) - 1, tile(y, at.mapY) - 1, 3, 3);
  ctx.fillRect(tile(x, at.mapX) + Math.round(Math.cos(angle) * 3), tile(y, at.mapY) + Math.round(Math.sin(angle) * 3), 1, 1);
}

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

/** A prop standing on its void tile, as big as its distance makes it. */
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
  const beyond = project(v, other.x, other.y, groundAt(track, other.x, other.y));
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
export const BOX_WORLD = 20;
const BLOB_WORLD = 12;
const ORB_WORLD = 9;

/** The pool of light under a box: wider than the box, three rows like a shadow, pulsing with the box; still when motion is reduced. */
export const POOL_WORLD = 26;
export const poolAlpha = (s: FrameState, z: number): number => (s.reduced ? 0.45 : 0.45 + 0.2 * Math.sin(s.t * 4 + z * 0.05));
function pool(ctx: CanvasRenderingContext2D, s: FrameState, at: Projected) {
  const w = POOL_WORLD * at.scale;
  if (w < 3) return;
  const row = Math.max(1, Math.round(w * 0.07));
  ctx.globalAlpha = poolAlpha(s, at.z);
  ctx.fillStyle = s.theme.gold;
  for (const [i, share] of ([[-1, 0.7], [0, 1], [1, 0.7]] as const)) {
    const rw = Math.round(w * share);
    ctx.fillRect(Math.round(at.sx - rw / 2), Math.round(at.sy + i * row), rw, row);
  }
  ctx.globalAlpha = 1;
}

/** An item box on the floor: a glowing cube that turns and bobs, as big as its distance makes it; still when motion is reduced. */
const BOX = 'item-box';
export const boxFrame = (s: FrameState, z: number): number => (s.reduced ? 0 : Math.floor(s.t * 3 + z * 0.01) % 2);
function itemBox(ctx: CanvasRenderingContext2D, s: FrameState, at: Projected) {
  const { w, h } = spriteSize(BOX);
  const scale = (BOX_WORLD * at.scale) / w;
  if (w * scale < 2) return;
  pool(ctx, s, at);
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
  trail: { token: 'cyan', size: 2.4 }, burst: { token: 'gold', size: 2.4 }, flash: { token: 'white', size: 3 },
};

/** The particles on the floor, near ones over far ones, each fading as it ages. None is drawn when motion is reduced: a frozen trail is noise. */
function particlesOn(ctx: CanvasRenderingContext2D, s: FrameState, v: View, particles: Particles, track: Track) {
  if (s.reduced) return;
  const seen = spritesInView(v, particles.list, (p) => groundAt(track, p.x, p.y));
  for (const { sprite: p, at } of seen) {
    const look = PARTICLE[p.kind];
    const size = Math.max(1, Math.round(look.size * at.scale));
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = s.theme[look.token];
    ctx.fillRect(Math.round(at.sx - size / 2), Math.round(at.sy - p.z * at.scale - size / 2), size, size);
  }
  ctx.globalAlpha = 1;
}

/** What `createKart` needs: the race's seed, and the rivals' drivers (the workspace's fleets); the circuit is COMET RING unless a test hands it another. */
export interface KartOptions { seed: number; cast?: readonly Driver[]; track?: Track; live?: LiveRace; /** A SINGLE race's laps and the rivals' difficulty (PRD 1762): the player's options. */ laps?: number; difficulty?: Difficulty; /** The player's kart's look (PRD 1762). */ look?: KartLook; /** Tests only: what the player holds from the start, so a test need not drive to a box. */ held?: Item }

/** A MULTI race (PRD 1572): the grid's session the race talks over, the start that began it and the player at this screen. */
export interface LiveRace { session: Pick<GridSession, 'send' | 'listen'>; start: RaceStart; me: GridPlayer }

/** The race as the arcade drives and draws it: the circuit loaded, the camera behind the player's kart. */
export function createKart({ seed, cast = [], track = parseTrack(), live, held, laps, difficulty, look }: KartOptions = { seed: 1359 }): KartGame {
  const first = newRace({ seed, track, cast, ...(laps !== undefined ? { laps } : {}), ...(difficulty ? { difficulty } : {}), ...(look ? { look } : {}), ...(live ? { field: { me: live.me.id, order: live.start.order } } : {}) });
  let race = held ? { ...first, fx: { ...first.fx, item: held } } : first;
  let texture: Texture | null = null;
  let particles = newParticles(seed);
  let ground: Ground | null = null;
  let tiles: MinimapTile[] | null = null;
  const tilesOf = (range: { low: number; high: number }): MinimapTile[] => (tiles ??= minimapTiles(track, range));
  const groundOf = (): Ground => {
    if (ground) return ground;
    texture ??= paintTrack(track);
    ground = { texture, heights: heightsOf(track, texture), range: reliefRange(track), deck: deckOf() };
    return ground;
  };
  // What stands still on the circuit stands on the ground under it, measured once.
  const standing = [
    ...track.props.map(({ kind, x, y }): Thing => ({ kind: 'prop', prop: kind, x, y, g: groundAt(track, x, y) })),
    ...track.arch.map(({ x, y }, leg): Thing => ({ kind: 'arch', leg: leg === 0 ? 0 : 1, x, y, g: groundAt(track, x, y) })),
  ];
  const floors = new Map<string, Floor>();
  const floorFor = (v: View): Floor => {
    const key = `${v.w}x${v.h}`;
    let floor = floors.get(key);
    if (!floor) {
      const canvas = document.createElement('canvas');
      canvas.width = v.w;
      canvas.height = v.h;
      const image = new ImageData(v.w, v.h);
      floor = { image, pixels: new Uint32Array(image.data.buffer), depth: new Float32Array(v.w * v.h), canvas };
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
  /** How far a point of the circuit is from the player, in tiles. */
  const tilesFrom = (x: number, y: number): number => Math.hypot(x - race.player.x, y - race.player.y) / TILE;
  const tell = (events: readonly RaceEvent[]) => {
    for (const e of events) told.push(...cuesOf(e, 'racer' in e ? tilesTo(e.racer) : 0));
  };

  // A MULTI race (PRD 1572) talks over the grid's session: it hears the others' states, their leaving and their finish, sends its own state at the
  // send rate and its `leave`, and starts its countdown at once, for the start has sent everyone to it. A message of another race is ignored.
  let sinceSent = 0;
  const onTheTrack = () => race.phase === 'countdown' || race.phase === 'race';
  const sendLeave = () => { if (live) live.session.send({ kind: 'leave', race: live.start.race }); };
  let stop: (() => void) | null = null;
  /** An item another player sent appears on the circuit, and is heard; the item that hit someone is gone from it, and the hit is heard. */
  const plantItem = (from: string, m: ItemMessage) => {
    const planted = plant(race, from, m);
    if (planted !== race) told.push({ kind: 'item', item: m.item, you: false, tiles: tilesFrom(m.x, m.y) });
    race = planted;
  };
  const liftItem = (id: string) => {
    const at = whereIs(race, id);
    if (at) told.push({ kind: 'hit', item: at.item, you: false, tiles: tilesFrom(at.x, at.y) });
    race = lift(race, id);
  };
  /** What a message of this race does to it, from the player who sent it (a `start` is the grid's business). */
  const onMessage = (from: string, m: RaceMessage) => {
    switch (m.kind) {
      case 'state': race = hear(race, from, m); break;
      case 'leave': race = dropOut(race, from); break;
      case 'finish': race = finishOf(race, from, m.tenths); break;
      case 'item': plantItem(from, m); break;
      case 'hit': liftItem(m.id); break;
      case 'start': break;
    }
  };
  if (live) {
    const { race: id } = live.start;
    stop = live.session.listen((from, body) => {
      const m = readMessage(body, id);
      if (m) onMessage(from, m);
    });
    const began = press(race, 'start');
    race = began.race;
    tell(began.events);
  }

  /** A BLOB dropped or an ORB fired is told to the others under its id; the player hit by one says so, which takes it off every circuit. */
  const relay = (link: LiveRace, events: readonly RaceEvent[]) => {
    for (const e of events) {
      if (e.kind === 'throw') link.session.send({ kind: 'item', race: link.start.race, id: e.id, item: e.item, x: e.x, y: e.y, angle: e.angle });
      else if (e.kind === 'hit' && e.racer === 0 && e.id !== undefined) link.session.send({ kind: 'hit', race: link.start.race, id: e.id });
    }
  };

  /** What a live step says over the link, and the time it hands the arcade: its state at the send rate, and at the line its finish. */
  const speak = (link: LiveRace, was: Race['phase'], dt: number, events: readonly RaceEvent[]): number | null => {
    relay(link, events);
    // The state goes out at the rate the number of players allows, once a step at most.
    if (was === 'race' && race.phase === 'race') {
      const every = 1 / rateFor(race.rivals.length + 1);
      sinceSent += dt;
      if (sinceSent >= every - 1e-9) {
        sinceSent = Math.min(sinceSent - every, every);
        const { player, pace, fx } = race;
        link.session.send({ kind: 'state', race: link.start.race, x: player.x, y: player.y, angle: player.angle, speed: player.speed, steer: player.steer, laps: pace.laps, passed: pace.passed, spin: fx.spin, fall: fx.fall });
      }
    }
    // Crossing the line at the end of the last lap tells the others the time, and gives it to the arcade for the score, as a solo race does.
    const done = events.find((e) => e.kind === 'finish');
    if (done?.kind !== 'finish') return null;
    link.session.send({ kind: 'finish', race: link.start.race, tenths: done.tenths });
    return done.tenths;
  };

  return {
    step(held: ReadonlySet<Action>, dt: number): number | null {
      const before = race;
      const r = step(race, held, dt);
      race = r.race;
      if (before.phase === 'race') particles = stepParticles(particles, spawnsOf(before, race, r.events), dt);
      tell(r.events);
      if (live) return speak(live, before.phase, dt, r.events);
      const done = r.events.find((e) => e.kind === 'finish');
      return done?.kind === 'finish' ? done.tenths : null;
    },
    press(action: Action): KartQuit {
      const r = press(race, action);
      race = r.race;
      tell(r.events);
      if (live) relay(live, r.events);
      const left = r.events.some((e) => e.kind === 'leave');
      if (left) sendLeave();
      const again = r.events.some((e) => e.kind === 'again');
      return { quit: r.events.some((e) => e.kind === 'quit'), again: again && !live, ...(live ? { grid: left || again } : {}) };
    },
    pause() { race = pause(race); },
    away() {
      const was = onTheTrack();
      race = away(race);
      if (was && race.phase === 'left') sendLeave();
    },
    close() {
      if (onTheTrack() && live) { sendLeave(); race = { ...race, phase: 'left', menu: false }; }
      stop?.();
      stop = null;
    },
    cues() { const out = told; told = []; return out; },
    speed: () => Math.min(1, Math.max(0, race.player.speed / RULES.topSpeed)),
    hud: () => hudOf(race),
    draw(ctx, s) {
      const { texture, heights, range, deck } = groundOf();
      const v = viewFor(s.grid, track, race.player);
      skyOf(ctx, s, v, seed);
      const floor = floorFor(v);
      renderTerrain(v, texture, heights, range, deck, floor.pixels, floor.depth);
      floor.canvas.getContext('2d')?.putImageData(floor.image, 0, 0);
      ctx.drawImage(floor.canvas, 0, 0);
      const things: Thing[] = [
        ...race.items.boxes.filter((b) => b.back <= 0).map((b): Thing => ({ kind: 'box', x: b.x, y: b.y, g: groundAt(track, b.x, b.y) })),
        ...race.items.blobs.map((b): Thing => ({ kind: 'blob', x: b.x, y: b.y, g: groundAt(track, b.x, b.y) })),
        ...race.items.orbs.map((o): Thing => ({ kind: 'orb', x: o.x, y: o.y, g: groundAt(track, o.x, o.y) })),
        ...race.rivals.map((rival): Thing => ({ kind: 'rival', rival, x: rival.kart.x, y: rival.kart.y, g: groundAt(track, rival.kart.x, rival.kart.y) })),
        ...standing,
      ];
      // The farthest first, so a near kart covers a far item; a hill's crest nearer than a thing hides it.
      for (const { sprite: thing, at } of spritesInView(v, things, (t) => t.g)) {
        // The arch spans the flat start straight and stays on top; the rest is hidden where the road in front covers it.
        const reach = at.scale * 40;
        const hid = thing.kind !== 'arch' && hideBehind(ctx, floor, v.w, v.h, { left: at.sx - reach, right: at.sx + reach, top: at.sy - reach * 1.5, bottom: at.sy + 2 }, at.z);
        if (thing.kind === 'rival') rivalKart(ctx, s, v, thing.rival, at, leanOf(track.map, thing.rival.kart));
        else if (thing.kind === 'box') itemBox(ctx, s, at);
        else if (thing.kind === 'prop') propSprite(ctx, s, at, thing.prop);
        else if (thing.kind === 'arch') archLeg(ctx, s, v, track, thing.leg, at);
        else thrownItem(ctx, s, at, thing.kind === 'blob' ? 'entropy' : 'orb');
        if (hid) ctx.restore();
      }
      particlesOn(ctx, s, v, particles, track);
      playerKart(ctx, s, race);
      minimap(ctx, s, track, tilesOf(range), race);
    },
  };
}
