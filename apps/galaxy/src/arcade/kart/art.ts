// OMNI KART on the arcade's canvas (PRD 1359): the Omni sky over the circuit in Mode 7, seen from
// behind the player's kart. The one file under arcade/kart/ that draws: everything it draws from is
// pure (track.ts, mode7.ts, texture.ts). The circuit's texture is painted once, the first time a race
// is drawn, and the floor goes through one pixel buffer per grid, allocated once and reused.
import { drawPlanet, drawStarfield } from '@omni/design';
import { H, nebulaFor, stars, W, type FrameState, type KartDraw } from '../scenes/common.ts';
import { chaseCamera, renderFloor, skyShift, viewOf, type Texture, type View } from './mode7';
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

/** The race as the arcade draws it: the circuit loaded, the camera behind the player's starting place. */
export function createKart(): KartDraw {
  const track: Track = parseTrack();
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
    draw(ctx, s) {
      const start = track.places[track.places.length - 1];
      if (!start) return;
      texture ??= paintTrack(track);
      const v = viewOf(s.grid, chaseCamera({ x: start.x, y: start.y, angle: track.heading }));
      skyOf(ctx, s, v);
      const floor = floorFor(v);
      renderFloor(v, texture, floor.pixels, BEYOND);
      floor.canvas.getContext('2d')?.putImageData(floor.image, 0, 0);
      ctx.drawImage(floor.canvas, 0, 0);
    },
  };
}
