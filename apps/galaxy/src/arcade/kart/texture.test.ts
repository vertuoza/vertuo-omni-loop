import { describe, expect, it } from 'vitest';
import { rampFrom } from '@omni/design';
import { TOKENS } from '../theme';
import { sure } from '../test/sure';
import { BEYOND, pack, paintTrack, SURFACE } from './texture';
import { cornersOf, isRoad, parseTrack, TILE, tileAt } from './track';

describe('pack', () => {
  it('packs #rrggbb as an opaque little-endian pixel: 0xAABBGGRR', () => {
    expect(pack('#102030')).toBe(0xff302010);
    expect(pack('#ffffff')).toBe(0xffffffff);
    expect(pack('#000000')).toBe(0xff000000);
  });
});

describe('SURFACE', () => {
  it('has no colour equal to a theme token (ADR-0046)', () => {
    const tokens = new Set(Object.values(TOKENS).map((c) => c.toLowerCase()));
    for (const [name, colour] of Object.entries(SURFACE)) expect(tokens.has(colour.toLowerCase()), name).toBe(false);
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
  const cyan = pack(SURFACE.neonCyan), magenta = pack(SURFACE.neonMagenta);
  const tilesOf = (c: string) => track.map.flatMap((row, y) => Array.from(row).flatMap((t, x) => (t === c ? [[x, y] as const] : [])));

  it('is one 16×16 tile per map tile, every pixel opaque', () => {
    expect(texture.w).toBe(64 * TILE);
    expect(texture.h).toBe(64 * TILE);
    expect(texture.px).toHaveLength(1024 * 1024);
    for (let i = 0; i < texture.px.length; i += 997) expect(sure(texture.px[i], 'a pixel') >>> 24).toBe(0xff);
  });

  it('paints the verge in the lunar ramp, and no colour of the road in it', () => {
    const road = new Set(rampFrom(SURFACE.road).map(pack));
    const verge = new Set(rampFrom(SURFACE.verge).map(pack));
    for (const [tx, ty] of tilesOf('.').filter((_, i) => i % 37 === 0)) {
      for (const c of tile(tx, ty)) { expect(verge.has(c)).toBe(true); expect(road.has(c)).toBe(false); }
    }
  });

  it('puts craters in the verge: some tile has a darker ring than the plain ground', () => {
    const darkest = pack(sure(rampFrom(SURFACE.verge)[3], 'the dark tone'));
    expect(tilesOf('.').some(([tx, ty]) => tile(tx, ty).has(darkest))).toBe(true);
  });

  it('paints the road in the road ramp, with a darker seam across the way forward every four tiles', () => {
    const road = new Set(rampFrom(SURFACE.road).map(pack));
    const seam = pack(sure(rampFrom(SURFACE.road)[3], 'the dark tone'));
    for (const c of tile(35, 56)) expect(road.has(c)).toBe(true);
    // The start straight runs east: a seam is the first pixel column of a tile whose column is a multiple of 4.
    for (let y = 0; y < TILE; y++) {
      expect(pixel(36 * TILE, 56 * TILE + y)).toBe(seam);   // tile 36: 36 % 4 === 0
      expect(pixel(35 * TILE, 56 * TILE + y)).not.toBe(seam);
      expect(pixel(37 * TILE, 56 * TILE + y)).not.toBe(seam);
    }
    // A leg running north: the seam is a pixel row, on tiles whose row is a multiple of 4.
    for (let x = 0; x < TILE; x++) {
      expect(pixel(54 * TILE + x, 48 * TILE)).toBe(seam);
      expect(pixel(54 * TILE + x, 47 * TILE)).not.toBe(seam);
    }
  });

  it('paints a wall tile dark metal, neon only where a side meets road or verge: cyan outside the circuit, magenta inside', () => {
    const metal = new Set(rampFrom(SURFACE.wall).map(pack));
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    const seen = { cyan: 0, magenta: 0 };
    for (const [tx, ty] of tilesOf('X')) {
      const facing = sides.some(([dx, dy]) => { const c = tileAt(track.map, tx + dx, ty + dy); return c === '.' || isRoad(c); });
      const colours = tile(tx, ty);
      const neon = [...colours].filter((c) => !metal.has(c));
      if (!facing) { expect(neon, `wall ${tx},${ty}`).toEqual([]); continue; }
      expect(neon).toHaveLength(1);
      expect([cyan, magenta]).toContain(neon[0]);
      if (neon[0] === cyan) seen.cyan++; else seen.magenta++;
      // The tile's middle is metal.
      expect(metal.has(pixel(tx * TILE + 7, ty * TILE + 7))).toBe(true);
    }
    expect(seen.cyan).toBeGreaterThan(0);
    expect(seen.magenta).toBeGreaterThan(0);
    // The outer border's wall beside the road is cyan; the infield's, in the loop's heart, magenta.
    expect(pixel(13 * TILE + 15, 56 * TILE + 5)).toBe(cyan);   // the left of the start straight, its wall on the outside
    expect(pixel(23 * TILE, 40 * TILE + 5)).toBe(magenta);     // the infield block, its west side on the verge
  });

  it('puts the neon on the side that meets the road: the whole edge, two pixels deep', () => {
    // Tile 13,56 is an outer wall with road to its east.
    for (let y = 0; y < TILE; y++) for (const x of [14, 15]) expect(pixel(13 * TILE + x, 56 * TILE + y)).toBe(cyan);
    expect(pixel(13 * TILE + 13, 56 * TILE + 8)).not.toBe(cyan);
  });

  it('alternates the two neon colours along a kerb', () => {
    const [tx, ty] = sure(tilesOf('r')[0], 'a kerb');
    expect(tile(tx, ty)).toEqual(new Set([cyan, magenta]));
    expect(pixel(tx * TILE, ty * TILE)).not.toBe(pixel(tx * TILE + 4, ty * TILE));
  });

  it('tells the surfaces apart: road, verge, wall, kerb and the start line differ', () => {
    const kinds = [tile(35, 56), tile(4, 4), tile(0, 0), tile(6, 6), tile(30, 56)];
    for (const [i, a] of kinds.entries()) for (const b of kinds.slice(i + 1)) expect([...a].some((c) => !b.has(c))).toBe(true);
    expect(tile(30, 56).size).toBeLessThanOrEqual(2); // the start line's chequer: light and dark
  });

  it('paints the same texture every time, and reads a wall past the map', () => {
    expect(paintTrack(track).px).toEqual(texture.px);
    expect(BEYOND).toBe(pack(SURFACE.wall));
  });

  describe('the chevrons', () => {
    const chevron = pack(SURFACE.chevron);
    const chevronsOf = (tx: number, ty: number) => {
      const out: [number, number][] = [];
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (pixel(tx * TILE + x, ty * TILE + y) === chevron) out.push([x, y]);
      return out;
    };
    const corners = cornersOf(track);

    it('stand three before each corner, on road tiles of the leg into it, the last two tiles before it', () => {
      for (const c of corners) {
        const [ix, iy] = c.into;
        for (const k of [2, 3, 4]) {
          const [tx, ty] = [c.x - ix * k, c.y - iy * k];
          expect(isRoad(tileAt(track.map, tx, ty)), `corner ${c.index}, ${k} tiles before`).toBe(true);
          expect(chevronsOf(tx, ty).length, `corner ${c.index}, ${k} tiles before`).toBeGreaterThan(0);
        }
        for (const k of [0, 1, 5]) expect(chevronsOf(c.x - ix * k, c.y - iy * k), `corner ${c.index}, ${k} tiles before`).toEqual([]);
      }
    });

    it('point the way the corner turns: the tip on the middle line, the arms trailing behind it', () => {
      for (const c of corners) {
        const [ix, iy] = c.into;
        const to = c.turn === 'right' ? [-iy, ix] : [iy, -ix];
        const px = chevronsOf(c.x - ix * 2, c.y - iy * 2).map(([x, y]) => ({
          u: (x - 7.5) * sure(to[0], 'to x') + (y - 7.5) * sure(to[1], 'to y'),
          v: Math.abs((x - 7.5) * -sure(to[1], 'to y') + (y - 7.5) * sure(to[0], 'to x')),
        }));
        const tip = px.reduce((a, b) => (b.u > a.u ? b : a));
        const tail = px.reduce((a, b) => (b.u < a.u ? b : a));
        expect(tip.v, `corner ${c.index}`).toBeLessThanOrEqual(1);
        expect(tail.v, `corner ${c.index}`).toBeGreaterThanOrEqual(5);
      }
    });

    it('are the only chevron-coloured pixels on the floor', () => {
      let n = 0;
      for (let i = 0; i < texture.px.length; i++) if (texture.px[i] === chevron) n++;
      const perTile = chevronsOf(sure(corners[0], 'a corner').x - sure(corners[0], 'a corner').into[0] * 2, sure(corners[0], 'a corner').y - sure(corners[0], 'a corner').into[1] * 2).length;
      expect(n).toBe(perTile * corners.length * 3);
    });
  });
});
