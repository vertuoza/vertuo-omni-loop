import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import {
  chaseCamera, depthAt, floorAt, horizonOf, NEAR, project, renderFloor, skyShift, spritesInView, viewOf, type Texture, type View,
} from './mode7';

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
