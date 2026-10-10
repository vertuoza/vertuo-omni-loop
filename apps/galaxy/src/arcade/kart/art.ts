// OMNI KART on the arcade's canvas (PRD 1359): the Omni sky over the circuit in Mode 7, seen from
// behind the player's kart, which is drawn over it with its driver in the seat. The one file under
// arcade/kart/ that draws: everything it draws from is pure (track.ts, mode7.ts, texture.ts, race.ts).
// The circuit's texture is painted once, the first time a race is drawn, and the floor goes through
// one pixel buffer per grid, allocated once and reused. It also holds the race the arcade steps.
import { drawPlanet, drawStarfield, fleetSprite, spriteImage } from '@omni/design';
import type { Action } from '../keys';
import { heroOf } from '../fleets';
import { stripesOf } from '../theme';
import { H, nebulaFor, sprite, stars, W, type FrameState } from '../scenes/common.ts';
import type { KartGame, KartQuit } from '../scenes/kart.ts';
import type { Kart } from './kart';
import { chaseCamera, renderFloor, skyShift, spritesInView, viewOf, type Projected, type Texture, type View } from './mode7';
import { hudOf, newRace, pause, press, step, type Race } from './race';
import type { Driver, Rival } from './rivals';
import { BEYOND, paintTrack } from './texture';
import { parseTrack, type Track } from './track';

/** A buffer the floor is rendered into, and the canvas it is drawn from. */
interface Floor { image: ImageData; pixels: Uint32Array; canvas: HTMLCanvasElement }

/** The sky's panorama, in screens: a full turn of the camera, for a field of view of 60° across one screen. */
const PANORAMA = 6;

/** A band at the horizon where the floor meets the sky. */
const HAZE = 5;

const wrap = (x: number, span: number) => ((x % span) + span) % span;

function skyOf(ctx: CanvasRenderingContext2D, s: FrameState, v: View) {
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
    cx: Math.round(wrap(shift + v.w * 0.7, v.w * PANORAMA) - v.w * 0.2), cy: sky - 20, r: Math.round(sky * 0.28), seed: 1359,
    rot: s.reduced ? 0 : s.t * 0.05, progress: 0.6, mood: 'alive', atmosphere: s.theme.cyan,
  });
  ctx.restore();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = s.theme['plasma-dark'];
  ctx.fillRect(0, sky - HAZE, v.w, HAZE);
  ctx.globalAlpha = 1;
}

/** The kart's art, in sprite pixels: its sprite's size, where the driver's shoulders meet the seat, and how much of the hero sits above it. */
const KART_W = 28;
const SEAT = 8;
const DRIVER_ROWS = 26;
const DRIVER_W = 32;

/** The kart's sprite for the way it is steered: leaning into the turn. */
const viewOfKart = (k: Kart): string => (k.steer < 0 ? 'kart-left' : k.steer > 0 ? 'kart-right' : 'kart');

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
  const driver = spriteImage(look.sprite, { tint: look.tint, flat: stripesOf(s.theme), frame });
  const lean = kart.steer * half;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(driver, 0, 0, DRIVER_W, DRIVER_ROWS, Math.round(x + (KART_W * scale - DRIVER_W * half) / 2 + lean), Math.round(y + SEAT * scale - DRIVER_ROWS * half), DRIVER_W * half, DRIVER_ROWS * half);
  sprite(ctx, s, viewOfKart(kart), x, y, { scale, tint: look.tint, frame });
}

/** How wide a kart stands in the world, in game pixels: a rival is drawn this wide, scaled by its distance. */
const KART_WORLD = 14;

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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(driver, 0, 0, DRIVER_W, DRIVER_ROWS, Math.round(x + (KART_W * scale - DRIVER_W * half) / 2), Math.round(y + SEAT * scale - DRIVER_ROWS * half), DRIVER_W * half, DRIVER_ROWS * half);
  ctx.drawImage(body, Math.round(x), Math.round(y), KART_W * scale, 18 * scale);
}

/** What `createKart` needs: the race's seed, and the rivals' drivers (the workspace's fleets). */
export interface KartOptions { seed: number; cast?: readonly Driver[] }

/** The race as the arcade drives and draws it: the circuit loaded, the camera behind the player's kart. */
export function createKart({ seed, cast = [] }: KartOptions = { seed: 1359 }): KartGame {
  const track: Track = parseTrack();
  let race = newRace({ seed, track, cast });
  let texture: Texture | null = null;
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

  return {
    step(held: ReadonlySet<Action>, dt: number): number | null {
      const r = step(race, held, dt);
      race = r.race;
      const done = r.events.find((e) => e.kind === 'finish');
      return done?.kind === 'finish' ? done.score : null;
    },
    press(action: Action): KartQuit {
      const r = press(race, action);
      race = r.race;
      return { quit: r.events.some((e) => e.kind === 'quit'), again: r.events.some((e) => e.kind === 'again') };
    },
    pause() { race = pause(race); },
    hud: () => hudOf(race),
    draw(ctx, s) {
      texture ??= paintTrack(track);
      const v = viewOf(s.grid, chaseCamera(race.player));
      skyOf(ctx, s, v);
      const floor = floorFor(v);
      renderFloor(v, texture, floor.pixels, BEYOND);
      floor.canvas.getContext('2d')?.putImageData(floor.image, 0, 0);
      ctx.drawImage(floor.canvas, 0, 0);
      for (const { sprite: r, at } of spritesInView(v, race.rivals.map((rival) => ({ ...rival, x: rival.kart.x, y: rival.kart.y })))) rivalKart(ctx, s, v, r, at);
      playerKart(ctx, s, race);
    },
  };
}
