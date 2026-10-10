import { describe, expect, it } from 'vitest';
import { rampFrom } from '@omni/design';
import { TOKENS } from '../theme';
import { sure } from '../test/sure';
import { BEYOND, pack, paintTrack, SURFACE } from './texture';
import { COMET_RING, cornersOf, isRoad, parseTrack, TILE, tileAt } from './track';

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
  /** COMET RING with its void drawn as `c`: the verge and the wall are still in the legend, though no circuit holds one. */
  const asTexture = (c: string) => {
    const map = COMET_RING.rows.map((row) => row.replaceAll('~', c));
    return paintTrack({ cols: track.cols, rows: track.rows, map, waypoints: track.waypoints });
  };
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
    const grass = asTexture('.');
    for (const [tx, ty] of tilesOf('~').filter((_, i) => i % 37 === 0)) {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const c = sure(grass.px[(ty * TILE + y) * grass.w + tx * TILE + x], 'a pixel');
          expect(verge.has(c)).toBe(true);
          expect(road.has(c)).toBe(false);
        }
      }
    }
  });

  it('puts craters in the verge: some tile has a darker ring than the plain ground', () => {
    const darkest = pack(sure(rampFrom(SURFACE.verge)[3], 'the dark tone'));
    const grass = asTexture('.');
    expect(grass.px.includes(darkest)).toBe(true);
  });

  it('paints a void tile as space: its own near-black ramp and a few stars, none of the road\'s colours', () => {
    const road = new Set(rampFrom(SURFACE.road).map(pack));
    const space = new Set([...rampFrom(SURFACE.void).map(pack), pack(SURFACE.starBright), pack(SURFACE.starDim)]);
    const stars = new Set([pack(SURFACE.starBright), pack(SURFACE.starDim)]);
    const edge = new Set([cyan, magenta]);
    let starred = 0;
    for (const [tx, ty] of tilesOf('~').filter((_, i) => i % 11 === 0)) {
      for (const c of tile(tx, ty)) {
        if (edge.has(c)) continue;
        expect(space.has(c), `void ${tx},${ty}`).toBe(true);
        expect(road.has(c)).toBe(false);
        if (stars.has(c)) starred++;
      }
    }
    expect(starred).toBeGreaterThan(0);
    // Deep in the void, a tile is the darkest tone with stars on it, and nothing else.
    expect(tile(1, 1).has(pack(sure(rampFrom(SURFACE.void)[3], 'the dark tone')))).toBe(true);
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

  it('paints neon on a void tile only where a side meets the road: cyan outside the circuit, magenta inside', () => {
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    const space = new Set([...rampFrom(SURFACE.void).map(pack), pack(SURFACE.starBright), pack(SURFACE.starDim)]);
    const seen = { cyan: 0, magenta: 0 };
    for (const [tx, ty] of tilesOf('~')) {
      const facing = sides.some(([dx, dy]) => isRoad(tileAt(track.map, tx + dx, ty + dy)));
      const neon = [...tile(tx, ty)].filter((c) => !space.has(c));
      if (!facing) { expect(neon, `void ${tx},${ty}`).toEqual([]); continue; }
      expect(neon).toHaveLength(1);
      expect([cyan, magenta]).toContain(neon[0]);
      if (neon[0] === cyan) seen.cyan++; else seen.magenta++;
    }
    expect(seen.cyan).toBeGreaterThan(0);
    expect(seen.magenta).toBeGreaterThan(0);
    // The void beside the start straight, outside the circuit, is cyan; the infield's, in the loop's heart, magenta.
    expect(pixel(15 * TILE + 15, 56 * TILE + 5)).toBe(cyan);
    expect(pixel(21 * TILE, 40 * TILE + 5)).toBe(magenta);
  });

  it('puts the neon on the void\'s side of the road\'s edge: the whole edge, two pixels deep', () => {
    // Tile 15,56 is void outside the circuit with road to its east.
    for (let y = 0; y < TILE; y++) for (const x of [14, 15]) expect(pixel(15 * TILE + x, 56 * TILE + y)).toBe(cyan);
    expect(pixel(15 * TILE + 13, 56 * TILE + 8)).not.toBe(cyan);
    // And the road's own tile stays road: no neon on it.
    expect(pixel(16 * TILE + 1, 57 * TILE + 8)).not.toBe(cyan);
  });

  it('alternates the two neon colours along a kerb', () => {
    const [tx, ty] = sure(tilesOf('r')[0], 'a kerb');
    expect(tile(tx, ty)).toEqual(new Set([cyan, magenta]));
    expect(pixel(tx * TILE, ty * TILE)).not.toBe(pixel(tx * TILE + 4, ty * TILE));
  });

  it('tells the surfaces apart: road, void, kerb and the start line differ', () => {
    const kinds = [tile(35, 56), tile(1, 1), tile(6, 40), tile(30, 56)];
    for (const [i, a] of kinds.entries()) for (const b of kinds.slice(i + 1)) expect([...a].some((c) => !b.has(c))).toBe(true);
    expect(tile(30, 56).size).toBeLessThanOrEqual(2); // the start line's chequer: light and dark
  });

  it('paints the same texture every time, and reads the void\'s darkest tone past the map', () => {
    expect(paintTrack(track).px).toEqual(texture.px);
    expect(BEYOND).toBe(pack(sure(rampFrom(SURFACE.void)[3], 'the dark tone')));
    const bright = (c: number) => (c & 0xff) + ((c >> 8) & 0xff) + ((c >> 16) & 0xff);
    for (const tone of rampFrom(SURFACE.void).map(pack)) expect(bright(BEYOND)).toBeLessThanOrEqual(bright(tone));
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
