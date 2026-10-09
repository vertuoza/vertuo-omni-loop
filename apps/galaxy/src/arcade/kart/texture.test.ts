import { describe, expect, it } from 'vitest';
import { rampFrom } from '@omni/design';
import { sure } from '../test/sure';
import { BEYOND, pack, paintTrack, SURFACE } from './texture';
import { parseTrack, TILE } from './track';

describe('pack', () => {
  it('packs #rrggbb as an opaque little-endian pixel: 0xAABBGGRR', () => {
    expect(pack('#102030')).toBe(0xff302010);
    expect(pack('#ffffff')).toBe(0xffffffff);
    expect(pack('#000000')).toBe(0xff000000);
  });
});

describe('paintTrack', () => {
  const track = parseTrack();
  const texture = paintTrack(track);
  const pixel = (x: number, y: number) => sure(texture.px[y * texture.w + x], `pixel ${x},${y}`);
  const tile = (tx: number, ty: number) => {
    const out = new Set<number>();
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out.add(pixel(tx * TILE + x, ty * TILE + y));
    return out;
  };

  it('is one 16×16 tile per map tile, every pixel opaque', () => {
    expect(texture.w).toBe(64 * TILE);
    expect(texture.h).toBe(64 * TILE);
    expect(texture.px).toHaveLength(1024 * 1024);
    for (let i = 0; i < texture.px.length; i += 997) expect(sure(texture.px[i], 'a pixel') >>> 24).toBe(0xff);
  });

  it('is painted from @omni/design ramps: the road in the road ramp, the grass in the grass ramp', () => {
    const road = new Set(rampFrom(SURFACE.road).map(pack));
    const grass = new Set(rampFrom(SURFACE.grass).map(pack));
    for (const c of tile(35, 56)) expect(road.has(c)).toBe(true);
    for (const c of tile(4, 4)) expect(grass.has(c)).toBe(true);
    for (const c of tile(4, 4)) expect(road.has(c)).toBe(false);
  });

  it('tells the surfaces apart: road, grass, wall, kerb and the start line differ', () => {
    const kinds = [tile(35, 56), tile(4, 4), tile(0, 0), tile(6, 6), tile(30, 56)];
    for (const [i, a] of kinds.entries()) for (const b of kinds.slice(i + 1)) expect([...a].some((c) => !b.has(c))).toBe(true);
    expect(tile(30, 56).size).toBeLessThanOrEqual(2); // the start line's chequer: white and dark
  });

  it('paints the same texture every time, and reads a wall past the map', () => {
    expect(paintTrack(track).px).toEqual(texture.px);
    expect(BEYOND).toBe(pack(SURFACE.wall));
  });
});
