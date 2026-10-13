import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import {
  chaseCamera, depthAt, floorAt, horizonOf, NEAR, project, renderFloor, renderTerrain, roofedOf, ROOF, skyShift, spritesInView, TUNNEL, viewOf, type Deck, type Texture, type View,
} from './mode7';
import { groundAt, heightsOf, reliefRange } from './relief';
import { BEYOND, deckOf, paintTrack } from './texture';
import { parseTrack, TILE } from './track';

const WIDE = { w: 640, h: 360 }, TALL = { w: 320, h: 288 };
const at = (angle: number, screen = WIDE): View => viewOf(screen, { x: 500, y: 400, angle });

describe('the horizon', () => {
  it('stands a third of the way down: the floor is 640×240 on the wide grid and 320×192 on the tall one', () => {
    expect(horizonOf(WIDE.h)).toBe(120);
    expect(horizonOf(TALL.h)).toBe(96);
    expect(WIDE.h - horizonOf(WIDE.h)).toBe(240);
    expect(TALL.h - horizonOf(TALL.h)).toBe(192);
  });
});

describe('floorAt', () => {
  it('finds no floor on or above the horizon', () => {
    const v = at(0.4);
    expect(floorAt(v, 320, 0)).toBeNull();
    expect(floorAt(v, 100, v.horizon - 1)).toBeNull();
    expect(floorAt(v, 100, v.horizon)).toBeNull();
    expect(floorAt(v, 320, v.horizon + 1)).not.toBeNull();
  });

  it('maps a floor pixel back to its point within a pixel, on both grids', () => {
    for (const screen of [WIDE, TALL]) {
      for (const angle of [0, 0.7, 2.4, -1.3]) {
        const v = at(angle, screen);
        for (const [sx, sy] of [[10.5, v.h - 3.5], [v.w / 2 + 0.5, v.horizon + 40.5], [v.w - 4.5, v.horizon + 90.5], [77.5, v.horizon + 12.5]] as const) {
          const point = sure(floorAt(v, sx, sy), 'a floor point');
          const back = sure(project(v, point.x, point.y), 'its screen point');
          expect(Math.abs(back.sx - sx), `x at ${sx},${sy}`).toBeLessThan(1);
          expect(Math.abs(back.sy - sy), `y at ${sx},${sy}`).toBeLessThan(1);
        }
      }
    }
  });

  it('turns what it samples with the camera: a quarter turn takes the point ahead from east to south', () => {
    const east = sure(floorAt(at(0), 320, 300), 'east');
    const south = sure(floorAt(at(Math.PI / 2), 320, 300), 'south');
    const reach = east.x - 500;
    expect(reach).toBeGreaterThan(0);
    expect(east.y).toBeCloseTo(400, 6);
    expect(south.x).toBeCloseTo(500, 6);
    expect(south.y - 400).toBeCloseTo(reach, 6);
  });
});

describe('project', () => {
  it('lands a point straight ahead on the centre column, higher the farther it is', () => {
    const v = at(0.9);
    const ahead = (d: number) => project(v, v.x + Math.cos(0.9) * d, v.y + Math.sin(0.9) * d);
    const ys = [40, 80, 160, 320, 640].map((d) => sure(ahead(d), `a point ${d} ahead`));
    for (const p of ys) expect(p.sx).toBeCloseTo(320, 6);
    for (let i = 1; i < ys.length; i++) expect(sure(ys[i], 'a point').sy).toBeLessThan(sure(ys[i - 1], 'the point before').sy);
    expect(sure(ys[4], 'the farthest').sy).toBeGreaterThan(v.horizon);
  });

  it('puts a point to the right of the way ahead on the right of the centre', () => {
    const v = at(0);
    expect(sure(project(v, 600, 460), 'right').sx).toBeGreaterThan(320);
    expect(sure(project(v, 600, 340), 'left').sx).toBeLessThan(320);
  });

  it('does not draw a point behind the camera, or closer than the near plane', () => {
    const v = at(0);
    expect(project(v, 400, 400)).toBeNull();
    expect(project(v, 500, 400)).toBeNull();
    expect(project(v, 500 + NEAR - 0.1, 400)).toBeNull();
    expect(project(v, 500 + NEAR + 1, 400)).not.toBeNull();
  });

  it('draws a sprite in inverse proportion to its distance', () => {
    const v = at(0);
    const near = sure(project(v, 600, 400), 'near'), far = sure(project(v, 700, 400), 'far');
    expect(near.z).toBe(100);
    expect(far.z).toBe(200);
    expect(near.scale / far.scale).toBeCloseTo(2, 9);
    expect(near.scale * near.z).toBeCloseTo(v.focal, 9);
  });
});

describe('spritesInView', () => {
  it('drops the sprites behind the camera and orders the rest from the farthest to the nearest', () => {
    const v = at(0);
    const sprites = [{ id: 'near', x: 560, y: 400 }, { id: 'behind', x: 300, y: 400 }, { id: 'far', x: 900, y: 420 }, { id: 'mid', x: 700, y: 380 }];
    expect(spritesInView(v, sprites).map((s) => s.sprite.id)).toEqual(['far', 'mid', 'near']);
  });
});

describe('renderFloor', () => {
  // A 64×64 texture whose pixel at x, y holds x + y·64 + 1: every sample says where it came from.
  const texture: Texture = { w: 64, h: 64, px: Uint32Array.from({ length: 64 * 64 }, (_, i) => i + 1) };
  const BEYOND = 0xdeadbeef;
  const small = viewOf({ w: 16, h: 12 }, { x: 32, y: 8, angle: Math.PI / 2 });

  it('draws nothing above the horizon, and the floor below it', () => {
    const out = new Uint32Array(16 * 12).fill(7);
    renderFloor(small, texture, out, BEYOND);
    for (let row = 0; row <= small.horizon; row++) for (let col = 0; col < 16; col++) expect(out[row * 16 + col], `row ${row}`).toBe(7);
    for (let row = small.horizon + 1; row < 12; row++) for (let col = 0; col < 16; col++) expect(out[row * 16 + col], `row ${row}`).not.toBe(7);
  });

  it('reads each floor pixel from the texture point it maps to, and the colour beyond for a point off the texture', () => {
    const v = viewOf({ w: 16, h: 12 }, { x: 32, y: 4, angle: Math.PI / 2 });
    const out = new Uint32Array(16 * 12);
    renderFloor(v, texture, out, BEYOND);
    for (const [col, row] of [[8, 10], [3, 11], [12, 9], [0, 6]] as const) {
      const p = sure(floorAt(v, col + 0.5, row + 0.5), 'the point');
      const tx = Math.floor(p.x), ty = Math.floor(p.y);
      const inside = tx >= 0 && ty >= 0 && tx < 64 && ty < 64;
      expect(out[row * 16 + col], `${col},${row}`).toBe(inside ? ty * 64 + tx + 1 : BEYOND);
    }
    const off = viewOf({ w: 16, h: 12 }, { x: -500, y: -500, angle: Math.PI });
    const none = new Uint32Array(16 * 12);
    renderFloor(off, texture, none, BEYOND);
    expect(none[11 * 16 + 8]).toBe(BEYOND);
  });

  it('turns the floor with the camera: a quarter turn samples other texels', () => {
    const big: Texture = { w: 512, h: 512, px: Uint32Array.from({ length: 512 * 512 }, (_, i) => i + 1) };
    const a = new Uint32Array(16 * 12), b = new Uint32Array(16 * 12);
    renderFloor(viewOf({ w: 16, h: 12 }, { x: 256, y: 256, angle: 0 }), big, a, BEYOND);
    renderFloor(viewOf({ w: 16, h: 12 }, { x: 256, y: 256, angle: Math.PI / 2 }), big, b, BEYOND);
    expect(a).not.toEqual(b);
  });
});

describe('chaseCamera', () => {
  it('stands behind the kart, looking where it heads', () => {
    const cam = chaseCamera({ x: 100, y: 200, angle: Math.PI / 2 });
    expect(cam.x).toBeCloseTo(100, 9);
    expect(cam.y).toBeLessThan(200);
    expect(cam.angle).toBe(Math.PI / 2);
  });

  it.each([['wide', WIDE], ['tall', TALL]] as const)('stands as far behind as it is told, so the kart lands on the row asked for, on the %s grid', (_name, screen) => {
    const kart = { x: 300, y: 200, angle: 0.7 };
    for (const row of [screen.h - 6, screen.h - 40]) {
      const v = viewOf(screen, chaseCamera(kart, depthAt(screen, row)));
      expect(sure(project(v, kart.x, kart.y), 'the kart').sy).toBeCloseTo(row, 6);
    }
  });
});

describe('skyShift', () => {
  it('scrolls the sky left as the camera turns right, and comes round after a full turn', () => {
    expect(skyShift(0, 1000)).toBe(0);
    expect(skyShift(Math.PI / 2, 1000)).toBeCloseTo(750, 9);
    expect(skyShift(Math.PI * 2, 1000)).toBeCloseTo(0, 6);
    expect(skyShift(-Math.PI / 2, 1000)).toBeCloseTo(250, 9);
  });
});

describe('the eye over the ground (PRD 1698)', () => {
  it('stands 28 over the ground under the kart: the camera is lifted with the ground', () => {
    expect(viewOf(WIDE, { x: 0, y: 0, angle: 0 }).height).toBe(28);
    expect(viewOf(WIDE, { x: 0, y: 0, angle: 0 }, 12).height).toBe(40);
  });

  it('projects a point on raised ground higher on the screen, by its height over the floor', () => {
    const v = viewOf(WIDE, { x: 100, y: 100, angle: 0 });
    const low = sure(project(v, 200, 100), 'the flat point'), high = sure(project(v, 200, 100, 10), 'the raised point');
    expect(high.sy).toBeLessThan(low.sy);
    expect(high.sy).toBeCloseTo(v.horizon + ((28 - 10) * v.focal) / 100, 9);
    expect(high.sx).toBeCloseTo(low.sx, 9);
    expect(high.z).toBe(low.z);
  });

  it('draws a sprite standing on raised ground higher: its ground is its own', () => {
    const v = viewOf(WIDE, { x: 100, y: 100, angle: 0 });
    const things = [{ x: 200, y: 100, up: 10 }, { x: 300, y: 100, up: 0 }];
    const seen = spritesInView(v, things, (t) => t.up);
    const raised = sure(seen.find((s) => s.sprite.up === 10), 'the raised sprite');
    expect(raised.at.sy).toBeCloseTo(v.horizon + ((28 - 10) * v.focal) / 100, 9);
    expect(seen.map((s) => s.at.z)).toEqual([200, 100]); // still the farthest first
  });
});

describe('renderTerrain (PRD 1698)', () => {
  const SCREEN = { w: 64, h: 96 };
  const ROAD = 0xff808080;
  const FLAT = { low: 0, high: 0 };
  const deck: Deck = {
    thickness: 12, wall: Uint32Array.of(0xff0000ff, 0xff00ff00, 0xffff0000), stripe: Uint32Array.of(0xff0000fe, 0xff00fe00, 0xfffe0000),
    glow: 18, glowPx: Uint32Array.of(0x80ffffff, 0x40ffffff),
  };
  const sidePx = new Set([...deck.wall, ...deck.stripe]);
  /** A 64×64 texture, the road where `road` says so. */
  const world = (road: (x: number, y: number) => boolean): Texture => ({ w: 64, h: 64, px: Uint32Array.from({ length: 64 * 64 }, (_, i) => (road(i % 64, Math.floor(i / 64)) ? ROAD : 0)) });
  const heightsOfWorld = (up: (x: number, y: number) => number): Float32Array => Float32Array.from({ length: 64 * 64 }, (_, i) => up(i % 64, Math.floor(i / 64)));
  const north = (y: number, screen = SCREEN): View => viewOf(screen, { x: 32, y, angle: -Math.PI / 2 });
  const draw = (v: View, texture: Texture, heights: Float32Array, range = FLAT) => {
    const out = new Uint32Array(v.w * v.h), depth = new Float32Array(v.w * v.h);
    const samples = renderTerrain(v, texture, heights, range, deck, out, depth);
    return { out, depth, samples };
  };
  const column = (out: Uint32Array, v: View, col = 32) => Array.from({ length: v.h }, (_, r) => out[r * v.w + col] ?? 0);

  it('draws the road, and leaves the space above the horizon see-through', () => {
    const v = north(70);
    const { out } = draw(v, world((_, y) => y < 40), heightsOfWorld(() => 0));
    const rows = column(out, v);
    expect(rows.some((p) => p === ROAD)).toBe(true);
    for (let r = 0; r <= v.horizon; r++) expect(rows[r], `row ${r}`).toBe(0);
  });

  it('draws a hill higher on the screen than the flat road behind it', () => {
    const v = north(70);
    const road = world((_, y) => y < 40);
    const top = (up: (x: number, y: number) => number) => column(draw(v, road, heightsOfWorld(up), { low: 0, high: 10 }).out, v).findIndex((p) => p === ROAD);
    const flat = top(() => 0), hill = top((_, y) => (y < 10 ? 10 : 0));
    expect(flat).toBeGreaterThan(v.horizon);
    expect(hill).toBeLessThan(flat);
  });

  it('gives each road pixel its distance as its depth, and Infinity elsewhere', () => {
    const v = north(70);
    const { out, depth } = draw(v, world((_, y) => y < 40), heightsOfWorld(() => 0));
    let checked = 0;
    for (const row of [v.horizon + 30, v.horizon + 55, v.h - 5]) {
      if (out[row * v.w + 32] !== ROAD) continue;
      const z = (v.height * v.focal) / (row + 0.5 - v.horizon);
      expect(Math.abs((depth[row * v.w + 32] ?? 0) - z) / z, `row ${row}`).toBeLessThan(0.05);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    for (let i = 0; i < out.length; i++) if (out[i] === 0) expect(depth[i]).toBe(Infinity);
  });

  it('hides the road behind a near crest: the rows it covers hold the crest, at its distance', () => {
    const v = north(70);
    const road = world(() => true);
    const flat = draw(v, road, heightsOfWorld(() => 0));
    // A ridge 20 high, 15 to 20 ahead, hides what stands behind it.
    const crest = draw(v, road, heightsOfWorld((_, y) => (y <= 55 && y > 50 ? 20 : 0)), { low: 0, high: 20 });
    const row = v.horizon + 28;
    expect(flat.depth[row * v.w + 32]).toBeGreaterThan(30);
    expect(crest.depth[row * v.w + 32]).toBeLessThan(30);
  });

  describe('the deck', () => {
    // The road ends 30 ahead of the camera, the void in front of it: its edge faces the camera.
    const v = north(60, { w: 64, h: 200 });
    const road = world((_, y) => y < 30);
    const rowOf = (up: number, z: number) => v.horizon + ((v.height - up) * v.focal) / z;

    it('shows the side of the deck under the road\'s edge, 12 deep, in the wall\'s colours', () => {
      const rows = column(draw(v, road, heightsOfWorld(() => 0)).out, v);
      const edge = Math.ceil(rowOf(0, 30)), base = Math.ceil(rowOf(-12, 30));
      expect(rows[edge - 2]).toBe(ROAD);
      const side = rows.slice(edge, base);
      expect(side.length).toBeGreaterThan(10);
      expect(side.every((p) => sidePx.has(p))).toBe(true);
      expect(sidePx.has(side[0] ?? 0)).toBe(true);
      expect(side.at(-1)).toBe(deck.wall.at(-1) ?? deck.stripe.at(-1));
    });

    it('lays a glow under the side, fading into the void over 18 units', () => {
      const rows = column(draw(v, road, heightsOfWorld(() => 0)).out, v);
      const base = Math.ceil(rowOf(-12, 30));
      expect(rows[base + 1]).toBe(deck.glowPx[0]);
      const end = Math.ceil(rowOf(-12, 30) + (18 * v.focal) / 30);
      expect(end).toBeLessThan(v.h);
      expect(rows[end + 2]).toBe(0);
    });

    it('lays the glow over what was there: a road far below shows through it', () => {
      const lowFar = heightsOfWorld((_, y) => (y < 10 ? -60 : 0));
      const rows = column(draw(v, world((_, y) => y < 10 || (y >= 20 && y < 30)), lowFar, { low: -60, high: 0 }).out, v);
      const far = Math.ceil(rowOf(-60, 55)) + 2;
      expect(far).toBeGreaterThan(Math.ceil(rowOf(-12, 30)) + 2);
      const seen = rows[far] ?? 0;
      expect(seen).not.toBe(ROAD);
      expect(deck.glowPx).not.toContain(seen);
      expect(seen >>> 24).toBe(0xff); // the glow's half-opaque magenta over opaque road
    });

    it('draws no side where the road starts with the road in front of it', () => {
      const { out } = draw(v, world((_, y) => y >= 30 && y < 50), heightsOfWorld(() => 0));
      expect(column(out, v).filter((p) => sidePx.has(p))).toHaveLength(0);
    });
  });

  describe('the cost guard', () => {
    const track = parseTrack();
    const texture = paintTrack(track);
    const heights = heightsOf(track, texture);
    const range = reliefRange(track);
    const edge = deckOf();
    const mask = roofedOf(track, texture);
    const KART_FOOT = 6;
    it.each([['wide', WIDE], ['tall', TALL]] as const)('takes at most 600 samples a column at every waypoint of COMET RING, facing the next one, on the %s grid', (_name, grid) => {
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
});

describe('renderFloor stays the flat floor', () => {
  it('still reads the texture one sample a screen pixel, as the cabinet\'s still draws it', () => {
    const v = viewOf({ w: 32, h: 24 }, { x: 600, y: 900, angle: -Math.PI / 2 });
    const out = new Uint32Array(32 * 24);
    renderFloor(v, paintTrack(parseTrack()), out, BEYOND);
    expect(out.some((p) => p >>> 24 === 0xff)).toBe(true);
  });
});

describe('the tunnel (PRD 1775)', () => {
  const SCREEN = { w: 128, h: 96 };
  const ROAD = 0xff808080;
  const deck: Deck = { thickness: 12, wall: Uint32Array.of(0xff0000ff), stripe: Uint32Array.of(0xff0000fe), glow: 18, glowPx: Uint32Array.of(0x80ffffff) };
  const FLAT = { low: 0, high: 0 };
  // A 64×256 world: a road 16 wide going north at x 24..40 over void, roofed from y 16 to y 240.
  const texture: Texture = { w: 64, h: 256, px: Uint32Array.from({ length: 64 * 256 }, (_, i) => (i % 64 >= 24 && i % 64 < 40 ? ROAD : 0)) };
  const roofed = Uint8Array.from({ length: 64 * 256 }, (_, i) => (i % 64 >= 24 && i % 64 < 40 && Math.floor(i / 64) >= 16 && Math.floor(i / 64) < 240 ? 1 : 0));
  const heights = new Float32Array(64 * 256);
  const draw = (v: View, mask: Uint8Array | null = roofed) => {
    const out = new Uint32Array(v.w * v.h), depth = new Float32Array(v.w * v.h);
    const samples = renderTerrain(v, texture, heights, FLAT, deck, out, depth, mask ?? undefined);
    return { out, depth, samples };
  };
  const rect = (out: Uint32Array, v: View, rows: [number, number], cols: [number, number] = [0, v.w]) => {
    const seen: number[] = [];
    for (let r = rows[0]; r < rows[1]; r++) for (let c = cols[0]; c < cols[1]; c++) seen.push(out[r * v.w + c] ?? 0);
    return seen;
  };
  const ceiling = new Set<number>([TUNNEL.ceilingA, TUNNEL.ceilingB, TUNNEL.ceilingSeam, TUNNEL.strip]);
  const inside = viewOf(SCREEN, { x: 32, y: 200, angle: -Math.PI / 2 });

  it('puts the roof 44 over the ground', () => {
    expect(ROOF).toBe(44);
  });

  it('marks the pixels of roofed road in the map', () => {
    const t = roofedOf({ map: ['~T~', '~#~'] }, { w: 3 * TILE, h: 2 * TILE, px: new Uint32Array(3 * TILE * 2 * TILE) });
    expect(t[8 * 48 + 24]).toBe(1);
    expect(t[8 * 48 + 8]).toBe(0);
    expect(t[24 * 48 + 24]).toBe(0);
  });

  it('draws ceiling, not sky, at the top of the frame with the camera inside: metal panels crossed by strips of light', () => {
    const { out } = draw(inside);
    const top = rect(out, inside, [0, 4], [50, 78]);
    expect(top.every((p) => ceiling.has(p))).toBe(true);
    expect(top).toContain(TUNNEL.strip);
    expect(top.some((p) => p !== TUNNEL.strip)).toBe(true);
    const sky = draw(inside, null).out;
    expect(rect(sky, inside, [0, 4], [50, 78]).every((p) => p === 0)).toBe(true);
  });

  it('shows portholes on the starfield in the walls, and the road below', () => {
    const { out, depth } = draw(inside);
    const wall = rect(out, inside, [inside.horizon - 20, inside.horizon + 14], [0, 24]);
    expect(wall.some((p) => p === TUNNEL.wallInA || p === TUNNEL.wallInB)).toBe(true);
    expect(wall).toContain(TUNNEL.rim);
    let holes = 0;
    for (let r = inside.horizon - 20; r < inside.horizon + 14; r++) for (let c = 0; c < 24; c++) if (out[r * inside.w + c] === 0 && (depth[r * inside.w + c] ?? Infinity) < Infinity) holes++;
    expect(holes).toBeGreaterThan(0);
    expect(rect(out, inside, [inside.h - 4, inside.h], [60, 68])).toContain(ROAD);
  });

  it('frames each end with a lit portal, seen from outside', () => {
    const south = viewOf(SCREEN, { x: 32, y: 250, angle: -Math.PI / 2 });
    expect(rect(draw(south).out, south, [0, south.h])).toContain(TUNNEL.portal);
    const north = viewOf(SCREEN, { x: 32, y: 4, angle: Math.PI / 2 });
    expect(rect(draw(north).out, north, [0, north.h])).toContain(TUNNEL.portal);
    expect(rect(draw(south, null).out, south, [0, south.h])).not.toContain(TUNNEL.portal);
  });

  it('shows the roof\'s top to an eye above it, and the road under it stays hidden', () => {
    const above = viewOf(SCREEN, { x: 32, y: 250, angle: -Math.PI / 2 }, 40);
    const seen = rect(draw(above).out, above, [0, above.h]);
    expect(seen.some((p) => p === TUNNEL.roofA || p === TUNNEL.roofB || p === TUNNEL.roofSeam)).toBe(true);
    const under = viewOf(SCREEN, { x: 32, y: 250, angle: -Math.PI / 2 });
    expect(rect(draw(under).out, under, [0, under.h]).some((p) => p === TUNNEL.roofA || p === TUNNEL.roofB || p === TUNNEL.roofSeam)).toBe(false);
  });

  it('hides a sprite behind a wall, on the far side from the camera: the depth buffer says so', () => {
    const v = viewOf({ w: 128, h: 288 }, { x: 12, y: 30, angle: 0 });
    const behind = sure(project(v, 36, 30, 0), 'the sprite');
    const head = Math.round(behind.sy) - 8; // a little above its feet, under the wall's top
    const { depth } = draw(v);
    expect(depth[head * v.w + Math.round(behind.sx)]).toBeLessThan(behind.z - 5);
    expect(depth[head * v.w + Math.round(behind.sx)]).toBeLessThan(14); // the wall stands 12 away, the sprite 24
  });

  describe('the cost guard, inside the tunnel and around it', () => {
    const track = parseTrack();
    const tex = paintTrack(track);
    const mask = roofedOf(track, tex);
    const hs = heightsOf(track, tex);
    const range = reliefRange(track);
    const edge = deckOf();
    const KART_FOOT = 6;
    it('has roofed road on the top leg: 13 tiles of it, between the corners [56, 8] and [36, 8]', () => {
      expect(mask.some((m) => m === 1)).toBe(true);
      expect(track.map.flatMap((row) => Array.from(row)).filter((c) => c === 'T')).toHaveLength(13 * 5);
    });
    it.each([['wide', WIDE], ['tall', TALL]] as const)('takes at most 600 samples a column at every waypoint and at points inside the tunnel, on the %s grid', (_name, grid) => {
      const out = new Uint32Array(grid.w * grid.h), depth = new Float32Array(grid.w * grid.h);
      const stops = [
        ...track.waypoints.map((w, i) => ({ ...w, next: sure(track.waypoints[(i + 1) % track.waypoints.length], 'the next waypoint') })),
        ...[52, 49, 46, 43, 40].map((tx) => ({ x: (tx + 0.5) * TILE, y: 8.5 * TILE, next: { x: 36.5 * TILE, y: 8.5 * TILE } })),
        ...[51, 46, 41].map((tx) => ({ x: (tx + 0.5) * TILE, y: 8.5 * TILE, next: { x: 56.5 * TILE, y: 8.5 * TILE } })),
      ];
      stops.forEach((w, i) => {
        const angle = Math.atan2(w.next.y - w.y, w.next.x - w.x);
        const v = viewOf(grid, chaseCamera({ x: w.x, y: w.y, angle }, depthAt(grid, grid.h - KART_FOOT)), groundAt(track, w.x, w.y));
        const samples = renderTerrain(v, tex, hs, range, edge, out, depth, mask);
        expect(samples, `stop ${i}`).toBeGreaterThan(50);
        expect(samples, `stop ${i}`).toBeLessThanOrEqual(600);
      });
    });
  });
});
