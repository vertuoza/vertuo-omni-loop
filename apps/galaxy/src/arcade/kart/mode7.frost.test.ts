import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import { chaseCamera, depthAt, renderTerrain, roofedOf, viewOf } from './mode7';
import { groundAt, heightsOf, reliefRange } from './relief';
import { deckOf, paintTrack } from './texture';
import { FROST_EIGHT, parseTrack } from './track';

const WIDE = { w: 640, h: 360 }, TALL = { w: 320, h: 288 };
const KART_FOOT = 6;

// The floor of FROST EIGHT costs no more than COMET RING's (PRD 1923): a column takes at most 600 samples, at every waypoint facing the next.
describe('the cost guard on FROST EIGHT', () => {
  const track = parseTrack(FROST_EIGHT);
  const texture = paintTrack(track);
  const heights = heightsOf(track, texture);
  const range = reliefRange(track);
  const edge = deckOf();
  const mask = roofedOf(track, texture);
  it.each([['wide', WIDE], ['tall', TALL]] as const)('takes at most 600 samples a column at every waypoint, facing the next one, on the %s grid', (_name, grid) => {
    const out = new Uint32Array(grid.w * grid.h), depth = new Float32Array(grid.w * grid.h);
    track.waypoints.forEach((w, i) => {
      const next = sure(track.waypoints[(i + 1) % track.waypoints.length], 'the next waypoint');
      const angle = Math.atan2(next.y - w.y, next.x - w.x);
      const camera = chaseCamera({ x: w.x, y: w.y, angle }, depthAt(grid, grid.h - KART_FOOT));
      const v = viewOf(grid, camera, groundAt(track, w.x, w.y));
      const samples = renderTerrain(v, texture, heights, range, edge, out, depth, mask);
      expect(samples, `waypoint ${i}`).toBeGreaterThan(50);
      expect(samples, `waypoint ${i}`).toBeLessThanOrEqual(600);
    });
  });
});
