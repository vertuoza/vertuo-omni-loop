import { describe, expect, it } from 'vitest';
import { rampFrom } from '@omni/design';
import { TOKENS } from '../theme';
import { sure } from '../test/sure';
import { BEYOND, DECK_DEPTH, DECK_GLOW, deckOf, pack, paintTrack, SURFACE, VOID } from './texture';
import { cornersOf, parseTrack, pointAtPx, TILE } from './track';

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
  const pixel = (x: number, y: number) => sure(texture.px[Math.floor(y) * texture.w + Math.floor(x)], `pixel ${x},${y}`);
  const tile = (tx: number, ty: number) => {
    const out = new Set<number>();
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out.add(pixel(tx * TILE + x, ty * TILE + y));
    return out;
  };
  const cyan = pack(SURFACE.neonCyan), magenta = pack(SURFACE.neonMagenta);
  const roadAt = (x: number, y: number) => track.road[Math.floor(y) * track.size.w + Math.floor(x)] === 1;
  /** A point `across` px to the left of the way the centre line runs at `along` px, and the unit step there. */
  const beside = (along: number, across: number) => {
    const p = pointAtPx(track, along);
    return { x: p.x + p.ty * across, y: p.y - p.tx * across, tx: p.tx, ty: p.ty };
  };
  const half = (track.centre.width / 2) * TILE;

  it('is one 16×16 tile per map tile, every pixel opaque or see-through', () => {
    expect(texture.w).toBe(72 * TILE);
    expect(texture.h).toBe(72 * TILE);
    expect(texture.px).toHaveLength(72 * TILE * 72 * TILE);
    for (let i = 0; i < texture.px.length; i += 997) expect([0, 0xff]).toContain(sure(texture.px[i], 'a pixel') >>> 24);
    for (let i = 0; i < texture.px.length; i += 61) if (track.road[i] === 1) expect(sure(texture.px[i], 'a road pixel') >>> 24).toBe(0xff);
  });

  it('leaves the void see-through, the floor having none there: nothing on it but its neon edge', () => {
    expect(VOID >>> 24).toBe(0);
    for (let i = 0; i < texture.px.length; i += 13) {
      if (track.road[i] === 1) continue;
      const c = sure(texture.px[i], 'a pixel');
      expect(c === VOID || c === cyan || c === magenta, `void pixel ${i}`).toBe(true);
    }
    // Deep in the void, a tile is see-through and nothing else.
    expect(tile(1, 1)).toEqual(new Set([VOID]));
  });

  it('paints the road in the road ramp, with a darker seam across the way forward every four tiles', () => {
    const ramp = rampFrom(SURFACE.road).map(pack);
    const seam = pack(sure(rampFrom(SURFACE.road)[3], 'the dark tone'));
    const road = new Set(ramp.slice(0, 3));
    // The start straight runs east at y 62.5: its seams are single columns, 4 tiles apart.
    const y = 62 * TILE + 3;
    const seams: number[] = [];
    for (let x = 38 * TILE; x < 54 * TILE; x++) {
      const c = pixel(x, y);
      if (c === seam) seams.push(x);
      else expect(road.has(c), `pixel ${x},${y}`).toBe(true);
    }
    expect(seams.length).toBeGreaterThanOrEqual(3);
    seams.slice(1).forEach((x, i) => { expect(x - sure(seams[i], 'a seam')).toBe(4 * TILE); });
    // A leg running south draws its seam across it, a pixel row.
    const rows: number[] = [];
    for (let py = 50 * TILE; py < 59 * TILE; py++) if (pixel(21.5 * TILE + 30, py) === seam) rows.push(py);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    rows.slice(1).forEach((r, i) => { expect(r - sure(rows[i], 'a seam')).toBe(4 * TILE); });
  });

  it('paints neon on the void\'s side of the road\'s edge: the whole edge, two pixels deep, cyan outside the circuit and magenta inside', () => {
    // The start straight's road is rows 960 to 1039; the void south of it is outside the circuit, the void north of it in its heart.
    for (let x = 38 * TILE; x < 52 * TILE; x += 5) {
      expect([pixel(x, 1039)].every((c) => c !== cyan && c !== magenta), 'the last road row').toBe(true);
      for (const y of [1040, 1041]) expect(pixel(x, y), `south ${x},${y}`).toBe(cyan);
      expect(pixel(x, 1042)).toBe(VOID);
      for (const y of [958, 959]) expect(pixel(x, y), `north ${x},${y}`).toBe(magenta);
      expect(pixel(x, 957)).toBe(VOID);
    }
  });

  it('paints neon only where a side of the road is, and all along it', () => {
    const w = track.size.w;
    const near = (i: number, reach: number) => {
      const x = i % w, y = (i - x) / w;
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (track.road[(y + dy) * w + x + dx] === 1) return true;
      return false;
    };
    for (let i = 3 * w; i < texture.px.length - 3 * w; i += 7) {
      const x = i % w;
      if (track.road[i] === 1 || x < 3 || x > w - 4) continue;
      const c = sure(texture.px[i], 'a pixel');
      if (c !== VOID) expect(near(i, 2), `neon pixel ${i}`).toBe(true);
      else expect(near(i, 1), `void pixel ${i}`).toBe(false);
    }
  });

  describe('the round edge', () => {
    const arcs = cornersOf(track);
    /** The point of an arc's outer edge at `k` of the way round it, `out` px beyond (negative: inside) the road's edge. */
    const outer = (c: (typeof arcs)[number], k: number, out: number) => beside((c.start + c.length * k) * TILE, (c.turn === 'left' ? -1 : 1) * (half + out));

    it('has neon on its void side, two pixels deep, and none past it', () => {
      let tested = 0;
      for (const c of arcs) {
        for (const k of [0.25, 0.5, 0.75]) {
          const [on, deep] = [outer(c, k, 1), outer(c, k, 5)];
          if (roadAt(on.x, on.y)) continue; // a shortcut's road leaves the circuit here
          tested++;
          expect([cyan, magenta], `arc ${c.index}, ${k}`).toContain(pixel(on.x, on.y));
          expect(roadAt(deep.x, deep.y) || pixel(deep.x, deep.y) === VOID, `arc ${c.index}, ${k}`).toBe(true);
        }
      }
      expect(tested).toBeGreaterThanOrEqual(arcs.length * 3 - 6);
    });

    it('has kerbs on the road along it, alternating cyan and magenta every four pixels, and none on the straights', () => {
      for (const c of arcs) {
        const colours: number[] = [];
        for (let s = 1; s < c.length * TILE - 1; s++) {
          const p = outer(c, s / (c.length * TILE), -4);
          colours.push(pixel(p.x, p.y));
        }
        const neon = colours.filter((x) => x === cyan || x === magenta);
        expect(new Set(neon), `arc ${c.index}`).toEqual(new Set([cyan, magenta]));
        expect(neon.length / colours.length, `arc ${c.index}`).toBeGreaterThan(0.85); // a chevron or a piece's road may cross it
        const inner = outer(c, 0.5, -TILE * 1.5);
        expect([cyan, magenta], `arc ${c.index}`).not.toContain(pixel(inner.x, inner.y));
      }
      const straight = beside(track.startAlong + 8 * TILE, half - 4);
      expect([cyan, magenta]).not.toContain(pixel(straight.x, straight.y));
    });

    it('follows the arc: the colour changes every four pixels of the way round', () => {
      const c = sure(arcs[0], 'an arc');
      let changes = 0, last = 0;
      for (let s = 0; s < c.length * TILE; s++) {
        const p = outer(c, s / (c.length * TILE), -4);
        const colour = pixel(p.x, p.y);
        if (s > 0 && colour !== last) changes++;
        last = colour;
      }
      expect(changes).toBeGreaterThanOrEqual(Math.floor((c.length * TILE) / 4) - 4);
      expect(changes).toBeLessThanOrEqual(Math.ceil((c.length * TILE) / 4) + 4);
    });
  });

  it('tells the surfaces apart: road, void and the start line differ', () => {
    const kinds = [tile(40, 62), tile(1, 1), tile(34, 61)];
    for (const [i, a] of kinds.entries()) for (const b of kinds.slice(i + 1)) expect([...a].some((c) => !b.has(c))).toBe(true);
    expect(tile(34, 61).size).toBeLessThanOrEqual(2); // the start line's chequer: light and dark
  });

  it('paints the same texture every time, and reads the void past the map: see-through too', () => {
    expect(paintTrack(track).px).toEqual(texture.px);
    expect(BEYOND).toBe(VOID);
  });

  describe('the chevrons', () => {
    const chevron = pack(SURFACE.chevron);
    const corners = cornersOf(track);
    const pointing = (c: (typeof corners)[number]): [number, number] => {
      const [ix, iy] = c.into;
      return c.turn === 'right' ? [-iy, ix] : [iy, -ix];
    };
    /** The chevron-coloured pixels within half a tile of a point, as (along the arrow, across it) from the point. */
    const around = (at: { x: number; y: number }, to: [number, number]) => {
      const out: { u: number; v: number }[] = [];
      for (let y = Math.floor(at.y - TILE / 2); y < at.y + TILE / 2; y++) {
        for (let x = Math.floor(at.x - TILE / 2); x < at.x + TILE / 2; x++) {
          if (pixel(x, y) !== chevron) continue;
          const cx = x + 0.5 - at.x, cy = y + 0.5 - at.y;
          out.push({ u: cx * to[0] + cy * to[1], v: Math.abs(cx * -to[1] + cy * to[0]) });
        }
      }
      return out;
    };

    it('stand three before each corner, on the straight into its arc, the last one a tile and a half before it', () => {
      for (const c of corners) {
        for (const k of [0, 1, 2]) {
          const at = pointAtPx(track, (c.start - 1.5 - k) * TILE);
          expect(around(at, pointing(c)).length, `corner ${c.index}, chevron ${k}`).toBeGreaterThan(0);
        }
        const inArc = pointAtPx(track, (c.start + c.length / 2) * TILE);
        expect(around(inArc, pointing(c)), `corner ${c.index}, in the arc`).toEqual([]);
      }
    });

    it('point the way the corner turns: the tip on the middle line, the arms trailing behind it', () => {
      for (const c of corners) {
        const px = around(pointAtPx(track, (c.start - 2.5) * TILE), pointing(c));
        const tip = px.reduce((a, b) => (b.u > a.u ? b : a));
        const tail = px.reduce((a, b) => (b.u < a.u ? b : a));
        expect(tip.v, `corner ${c.index}`).toBeLessThanOrEqual(1);
        expect(tail.v, `corner ${c.index}`).toBeGreaterThanOrEqual(5);
      }
    });

    it('are the only chevron-coloured pixels on the floor, but the ramps\' arrows', () => {
      const ramps = track.map.flatMap((row, y) => Array.from(row).flatMap((t, x) => (t === '^' ? [{ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }] : [])));
      const stamps = corners.flatMap((c) => [0, 1, 2].map((k) => pointAtPx(track, (c.start - 1.5 - k) * TILE)));
      for (let i = 0; i < texture.px.length; i++) {
        if (texture.px[i] !== chevron) continue;
        const x = (i % texture.w) + 0.5, y = Math.floor(i / texture.w) + 0.5;
        const ok = stamps.some((s) => Math.abs(s.x - x) <= TILE / 2 && Math.abs(s.y - y) <= TILE / 2) || ramps.some((r) => Math.hypot(r.x - x, r.y - y) <= 3 * TILE);
        expect(ok, `chevron pixel ${x},${y}`).toBe(true);
      }
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
  const track = parseTrack();
  const texture = paintTrack(track);
  const pixel = (x: number, y: number) => sure(texture.px[Math.floor(y) * texture.w + Math.floor(x)], `pixel ${x},${y}`);
  const tile = (tx: number, ty: number) => {
    const out = new Set<number>();
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out.add(pixel(tx * TILE + x, ty * TILE + y));
    return out;
  };
  const colours = (...hex: string[]) => new Set(hex.map(pack));
  const inside = (got: Set<number>, allowed: Set<number>) => [...got].every((c) => allowed.has(c));
  const onLine = (d: number) => pointAtPx(track, (sure(track.span, 'the span').start + d) * TILE);
  const tileOf = (d: number): [number, number] => {
    const p = onLine(d);
    return [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
  };
  /** The pixels of a tile painted `colour`, as (x, y) from the tile's corner. */
  const where = (tx: number, ty: number, colour: number) => {
    const out: [number, number][] = [];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (pixel(tx * TILE + x, ty * TILE + y) === colour) out.push([x, y]);
    return out;
  };

  it('paints a pad cyan, with chevrons pointing the way of the race (north on the gap jump\'s run-up, east on the start straight)', () => {
    const pad = tile(64, 26);
    expect(inside(pad, colours(SURFACE.pad, SURFACE.padChevron))).toBe(true);
    expect(pad.has(pack(SURFACE.padChevron))).toBe(true);
    expect(pad.has(pack(SURFACE.pad))).toBe(true);
    const north = where(64, 26, pack(SURFACE.padChevron));
    const tipUp = north.reduce((a, b) => (b[1] < a[1] ? b : a)), tail = north.reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(Math.abs(tipUp[0] - 7.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(tail[0] - 7.5)).toBeGreaterThanOrEqual(5);
    const east = where(25, 63, pack(SURFACE.padChevron));
    const tipRight = east.reduce((a, b) => (b[0] > a[0] ? b : a)), back = east.reduce((a, b) => (b[0] < a[0] ? b : a));
    expect(Math.abs(tipRight[1] - 7.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(back[1] - 7.5)).toBeGreaterThanOrEqual(5);
  });

  it('paints a ramp in yellow and black stripes', () => {
    expect(tile(64, 22)).toEqual(colours(SURFACE.rampYellow, SURFACE.rampBlack));
    expect(tile(8, 28)).toEqual(colours(SURFACE.rampYellow, SURFACE.rampBlack));
  });

  it('paints a yellow arrow on each of the two road tiles before a ramp, pointing the way of the race, and on no other', () => {
    const yellow = pack(SURFACE.chevron);
    expect(where(64, 23, yellow).length).toBeGreaterThan(0);
    expect(where(64, 24, yellow).length).toBeGreaterThan(0);
    expect(where(64, 25, yellow)).toEqual([]);
    const tip = where(64, 23, yellow).reduce((a, b) => (b[1] < a[1] ? b : a));
    expect(Math.abs(tip[0] - 7.5)).toBeLessThanOrEqual(1);
  });

  it('paints roofed road and the road within three tiles of it as station plating, a seam and a rivet', () => {
    const plating = colours(SURFACE.plate, SURFACE.plateSeam, SURFACE.plateRivet);
    // The tunnel's straight, 13 tiles in from the arc of waypoint 5: roofed; and 1 and 2 tiles past its end.
    const [rx, ry] = tileOf(10.4);
    expect(inside(tile(rx, ry), plating)).toBe(true);
    expect(tile(rx, ry).has(pack(SURFACE.plateRivet))).toBe(true);
    expect(tile(rx, ry).has(pack(SURFACE.plateSeam))).toBe(true);
    for (const d of [13.5, 14.5]) expect(inside(tile(...tileOf(d)), plating), `${d} in`).toBe(true);
    expect(inside(tile(...tileOf(18.5)), plating)).toBe(false); // plain road again
  });

  it('paints a walkway as a dark grating, magenta where it meets the void, as wide as its piece', () => {
    const piece = sure(track.centre.pieces.find((p) => p.surface === 'grating'), 'the walkway');
    const x = 35 * TILE + 5;
    const column = Array.from({ length: track.size.h }, (_, y) => y).filter((y) => track.road[y * track.size.w + x] === 1 && Math.abs(y - piece.from.y * TILE) < 3 * TILE);
    expect(column.length).toBeGreaterThanOrEqual(piece.width * TILE - 1);
    expect(column.length).toBeLessThanOrEqual(piece.width * TILE + 1);
    const colours3 = colours(SURFACE.grating, SURFACE.gratingBar, SURFACE.neonMagenta);
    for (const y of column) expect(colours3.has(pixel(x, y)), `row ${y}`).toBe(true);
    expect(pixel(x, sure(column[0], 'the top row'))).toBe(pack(SURFACE.neonMagenta));
    expect(pixel(x, sure(column.at(-1), 'the bottom row'))).toBe(pack(SURFACE.neonMagenta));
    const middle = sure(column[Math.floor(column.length / 2)], 'a middle row');
    expect(pixel(x, middle)).not.toBe(pack(SURFACE.neonMagenta));
    const seen = new Set(column.map((y) => pixel(x, y)));
    expect(seen.has(pack(SURFACE.grating)) || seen.has(pack(SURFACE.gratingBar))).toBe(true);
  });

  it('paints COMET RING\'s own pads, ramps, plating and walkway', () => {
    const seen = new Set<number>(texture.px);
    for (const colour of [SURFACE.pad, SURFACE.padChevron, SURFACE.rampYellow, SURFACE.rampBlack, SURFACE.plate, SURFACE.grating, SURFACE.gratingBar]) expect(seen.has(pack(colour)), colour).toBe(true);
  });
});

