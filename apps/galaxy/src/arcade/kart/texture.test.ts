import { describe, expect, it } from 'vitest';
import { rampFrom } from '@omni/design';
import { TOKENS } from '../theme';
import { sure } from '../test/sure';
import { BEYOND, DECK_DEPTH, DECK_GLOW, deckOf, pack, paintTrack, SURFACE, VOID } from './texture';
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

  it('is one 16×16 tile per map tile, every pixel opaque or see-through', () => {
    expect(texture.w).toBe(64 * TILE);
    expect(texture.h).toBe(64 * TILE);
    expect(texture.px).toHaveLength(1024 * 1024);
    for (let i = 0; i < texture.px.length; i += 997) expect([0, 0xff]).toContain(sure(texture.px[i], 'a pixel') >>> 24);
    for (const [tx, ty] of tilesOf('#').filter((_, i) => i % 7 === 0)) for (const c of tile(tx, ty)) expect(c >>> 24, `road ${tx},${ty}`).toBe(0xff);
  });

  it('leaves a void tile see-through, the floor having none there: nothing on it but its neon edge', () => {
    expect(VOID >>> 24).toBe(0);
    const edge = new Set([cyan, magenta]);
    for (const [tx, ty] of tilesOf('~').filter((_, i) => i % 11 === 0)) {
      for (const c of tile(tx, ty)) expect(c === VOID || edge.has(c), `void ${tx},${ty}`).toBe(true);
    }
    // Deep in the void, a tile is see-through and nothing else.
    expect(tile(1, 1)).toEqual(new Set([VOID]));
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
    const space = new Set([VOID]);
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

  it('paints the same texture every time, and reads the void past the map: see-through too', () => {
    expect(paintTrack(track).px).toEqual(texture.px);
    expect(BEYOND).toBe(VOID);
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

describe('the deck (PRD 1698)', () => {
  const deck = deckOf();

  it('is 12 deep, with a glow of 18 under it', () => {
    expect([DECK_DEPTH, DECK_GLOW]).toEqual([12, 18]);
    expect([deck.thickness, deck.glow]).toEqual([12, 18]);
  });

  it('shades its side from a light lip down to a magenta neon line at its foot, every other panel a shade darker', () => {
    const lum = (p: number) => (p & 0xff) + ((p >>> 8) & 0xff) + ((p >>> 16) & 0xff);
    expect(deck.wall.at(-1)).toBe(pack(SURFACE.neonMagenta));
    expect(deck.stripe.at(-1)).toBe(pack(SURFACE.neonMagenta));
    expect(lum(sure(deck.wall[0], 'the lip'))).toBeGreaterThan(lum(sure(deck.wall[4], 'the metal')));
    expect(lum(sure(deck.wall[2], 'a panel'))).toBeGreaterThan(lum(sure(deck.wall[7], 'a panel lower down')));
    for (let i = 1; i < deck.wall.length - 1; i++) expect(lum(sure(deck.stripe[i], 'a darker panel')), `level ${i}`).toBeLessThan(lum(sure(deck.wall[i], 'a panel')));
    for (const p of [...deck.wall, ...deck.stripe]) expect(p >>> 24).toBe(0xff);
  });

  it('glows magenta, half opaque at most and fading away from the deck', () => {
    expect(deck.glowPx.length).toBeGreaterThan(1);
    const alphas = Array.from(deck.glowPx, (p) => p >>> 24);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0x80);
    expect(alphas).toEqual([...alphas].sort((a, b) => b - a));
    expect(new Set(alphas).size).toBe(alphas.length);
    for (const p of deck.glowPx) expect(p & 0xffffff).toBe(pack(SURFACE.neonMagenta) & 0xffffff);
  });
});

describe('the station\'s tiles (PRD 1775)', () => {
  // A small fixture: a road running east along row 5 (waypoints at its ends), with a ramp, a pad, a tunnel and a walkway.
  const rows = [
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '########+###^######TTTTT#########wwww~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ];
  const map = rows;
  const track = { cols: 44, rows: 7, map, waypoints: [{ x: 8, y: 5.5 * TILE }, { x: 32 * TILE, y: 5.5 * TILE }] };
  const texture = paintTrack(track);
  const pixel = (x: number, y: number) => sure(texture.px[y * texture.w + x], `pixel ${x},${y}`);
  const tile = (tx: number, ty: number) => {
    const out = new Set<number>();
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out.add(pixel(tx * TILE + x, ty * TILE + y));
    return out;
  };
  const colours = (...hex: string[]) => new Set(hex.map(pack));
  const inside = (got: Set<number>, allowed: Set<number>) => [...got].every((c) => allowed.has(c));

  it('paints a pad cyan, with chevrons pointing the way of the race (east)', () => {
    const pad = tile(8, 5);
    expect(inside(pad, colours(SURFACE.pad, SURFACE.padChevron))).toBe(true);
    expect(pad.has(pack(SURFACE.padChevron))).toBe(true);
    expect(pad.has(pack(SURFACE.pad))).toBe(true);
    // The tip is on the east of the tile: more chevron pixels east of the middle's tip than at the tail.
    const col = (x: number) => Array.from({ length: TILE }, (_, y) => pixel(8 * TILE + x, 5 * TILE + y)).filter((c) => c === pack(SURFACE.padChevron)).length;
    expect(col(11)).toBeGreaterThan(0);
    expect(col(2)).toBe(0);
  });

  it('paints a ramp in yellow and black stripes', () => {
    expect(tile(12, 5)).toEqual(colours(SURFACE.rampYellow, SURFACE.rampBlack));
  });

  it('paints a yellow arrow on each of the two road tiles before a ramp, and on no other', () => {
    const yellow = pack(SURFACE.chevron);
    expect(tile(11, 5).has(yellow)).toBe(true);
    expect(tile(10, 5).has(yellow)).toBe(true);
    expect(tile(9, 5).has(yellow)).toBe(false);
    expect(tile(13, 5).has(yellow)).toBe(false); // after the ramp
    // The tip points east: no yellow in the tile's first columns' middle, some in the last ones.
    const mid = (x: number) => pixel(11 * TILE + x, 5 * TILE + 7) === yellow || pixel(11 * TILE + x, 5 * TILE + 8) === yellow;
    expect(mid(11)).toBe(true);
    expect(mid(2)).toBe(false);
  });

  it('paints roofed road and the road within three tiles of it as station plating, a seam and a rivet', () => {
    const plating = colours(SURFACE.plate, SURFACE.plateSeam, SURFACE.plateRivet);
    expect(inside(tile(21, 5), plating)).toBe(true);   // roofed
    expect(inside(tile(18, 5), plating)).toBe(true);   // 1 before the portal
    expect(inside(tile(16, 5), plating)).toBe(true);   // 3 before
    expect(inside(tile(24, 5), plating)).toBe(true);   // after the roof
    expect(inside(tile(26, 5), plating)).toBe(true);
    expect(tile(21, 5).has(pack(SURFACE.plateRivet))).toBe(true);
    expect(tile(21, 5).has(pack(SURFACE.plateSeam))).toBe(true);
    expect(inside(tile(15, 5), plating)).toBe(false);  // 4 before: plain road
    expect(inside(tile(27, 5), plating)).toBe(false);
  });

  it('paints a walkway as a dark grating, magenta where it meets the void', () => {
    const magenta = pack(SURFACE.neonMagenta);
    // Tile 34 has void above and below: magenta on its top and bottom edges, grating between; tile 33 (road to its west) none on the west side.
    expect(inside(tile(34, 5), colours(SURFACE.grating, SURFACE.gratingBar, SURFACE.neonMagenta))).toBe(true);
    for (let x = 0; x < TILE; x++) {
      expect(pixel(34 * TILE + x, 5 * TILE)).toBe(magenta);
      expect(pixel(34 * TILE + x, 5 * TILE + TILE - 1)).toBe(magenta);
    }
    expect(pixel(34 * TILE + 5, 5 * TILE + 5)).not.toBe(magenta);
    expect(pixel(33 * TILE, 5 * TILE + 5)).not.toBe(magenta); // 33 meets road to its west
    expect(tile(34, 5).has(pack(SURFACE.gratingBar))).toBe(true);
    expect(tile(34, 5).has(pack(SURFACE.grating))).toBe(true);
    // The end that meets the void is magenta too.
    expect(pixel(36 * TILE + TILE - 1, 5 * TILE + 5)).toBe(magenta);
  });

  it('leaves COMET RING\'s own road as it was: no pad, no ramp, no plating', () => {
    const comet = paintTrack(parseTrack());
    const bad = new Set([SURFACE.pad, SURFACE.padChevron, SURFACE.rampYellow, SURFACE.rampBlack, SURFACE.plate, SURFACE.plateSeam, SURFACE.plateRivet, SURFACE.grating, SURFACE.gratingBar].map(pack));
    for (let i = 0; i < comet.px.length; i++) if (bad.has(sure(comet.px[i], 'a pixel'))) throw new Error(`pixel ${i} is a station colour`);
  });
});
