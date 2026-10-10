import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { driveKart, kartAt, NO_FX, padOf, stepFx, tippedOver, turnRate, type Fx, type Kart, type Pad } from './kart';
import { RULES } from './rules';
import { isRoad, TILE, tileAt } from './track';

// The kart's own rules (PRD 1359, slice 2): speed, steering and the void off the road, on small hand-drawn maps
// so each rule is proved alone.

const NONE: Pad = { left: false, right: false, accel: false, brake: false };
const pad = (p: Partial<Pad>): Pad => ({ ...NONE, ...p });

// A road three tiles wide running east, void beside it.
const MAP = [
  '~'.repeat(40),
  '~'.repeat(40),
  '#'.repeat(40),
  '#'.repeat(40),
  '#'.repeat(40),
  '~'.repeat(40),
  '~'.repeat(40),
] as const;
const middle = 3.5 * TILE;
const play = (k: Kart, p: Pad, seconds: number, dt = RULES.subStep): Kart => {
  let out = k;
  for (let t = 0; t < seconds; t += dt) out = driveKart(out, p, dt);
  return out;
};
const rolling = (speed: number, angle = 0): Kart => ({ ...kartAt(20 * TILE, middle, angle), speed });

describe('speed', () => {
  it('accelerates up to its top speed with A held, and no further', () => {
    const k = play(kartAt(2 * TILE, middle, 0), pad({ accel: true }), 0.5);
    expect(k.speed).toBeGreaterThan(0);
    expect(k.speed).toBeLessThan(RULES.topSpeed);
    const fast = play(kartAt(1 * TILE, middle, 0), pad({ accel: true }), 2);
    expect(fast.speed).toBeCloseTo(RULES.topSpeed, 5);
  });

  it('slows when A is released, down to a stop', () => {
    const k = play(rolling(RULES.topSpeed), NONE, 0.5);
    expect(k.speed).toBeLessThan(RULES.topSpeed);
    expect(k.speed).toBeGreaterThan(0);
    expect(play(rolling(RULES.topSpeed), NONE, 3).speed).toBe(0);
  });

  it('slows a kart that was reversing, up to a stop, when nothing is held', () => {
    const k = play(rolling(-RULES.reverseSpeed, Math.PI), NONE, 3);
    expect(k.speed).toBe(0);
  });

  it('brakes with ▼ down to a stop, then reverses once stopped, up to the reverse speed', () => {
    let k = rolling(RULES.topSpeed);
    let stoppedAt = -1;
    for (let i = 0; i < 600; i++) {
      k = driveKart(k, pad({ brake: true }), RULES.subStep);
      if (k.speed === 0 && stoppedAt < 0) stoppedAt = i;
    }
    expect(stoppedAt).toBeGreaterThan(0);
    expect(stoppedAt * RULES.subStep).toBeCloseTo(RULES.topSpeed / RULES.brake, 1);
    expect(k.speed).toBe(-RULES.reverseSpeed);
  });

  it('brakes harder than it coasts', () => {
    expect(play(rolling(80), pad({ brake: true }), 0.2).speed).toBeLessThan(play(rolling(80), NONE, 0.2).speed);
  });

  it('brakes before it accelerates when both are held', () => {
    expect(play(rolling(80), pad({ brake: true, accel: true }), 0.2).speed).toBeLessThan(80);
  });

  it('stops a reversing kart before A takes it forwards', () => {
    const k = play(rolling(-30, Math.PI), pad({ accel: true }), 0.1);
    expect(k.speed).toBeGreaterThan(-30);
    expect(driveKart(rolling(-1, Math.PI), pad({ accel: true }), 0.01).speed).toBe(0);
  });

  it('moves the way it faces, at its speed', () => {
    const k = driveKart(rolling(60), NONE, 0.01);
    expect(k.x).toBeGreaterThan(20 * TILE);
    expect(k.y).toBeCloseTo(middle, 5);
    const back = driveKart(rolling(-30), NONE, 0.01);
    expect(back.x).toBeLessThan(20 * TILE);
  });
});

describe('steering', () => {
  it('does not turn a kart at rest', () => {
    expect(turnRate(0)).toBe(0);
    const k = driveKart(kartAt(3 * TILE, middle, 0.3), pad({ left: true }), 0.1);
    expect(k.angle).toBe(0.3);
  });

  it('turns right with ▶ and left with ◀ (the angle runs clockwise, y down)', () => {
    expect(driveKart(rolling(40), pad({ right: true }), 0.05).angle).toBeGreaterThan(0);
    expect(driveKart(rolling(40), pad({ left: true }), 0.05).angle).toBeLessThan(0);
    expect(driveKart(rolling(40), pad({ left: true, right: true }), 0.05).angle).toBe(0);
  });

  it('turns a fast kart less than a slow one', () => {
    expect(turnRate(RULES.gripSpeed)).toBeGreaterThan(turnRate(RULES.topSpeed));
    expect(turnRate(RULES.topSpeed)).toBeCloseTo(RULES.steer * RULES.steerAtTop, 10);
    expect(turnRate(RULES.gripSpeed / 2)).toBeLessThan(turnRate(RULES.gripSpeed));
    expect(turnRate(-RULES.gripSpeed)).toBe(turnRate(RULES.gripSpeed));
  });

  it('steers the other way when reversing', () => {
    expect(driveKart(rolling(-30), pad({ right: true }), 0.05).angle).toBeLessThan(0);
  });

  it('leans the kart into the turn it is steered', () => {
    expect(driveKart(rolling(40), pad({ right: true }), 0.01).steer).toBe(1);
    expect(driveKart(rolling(40), pad({ left: true }), 0.01).steer).toBe(-1);
    expect(driveKart(rolling(40), NONE, 0.01).steer).toBe(0);
  });
});

describe('off the road', () => {
  it('slows nothing and bounces nothing: a kart at top speed that leaves the road falls where it went over, at rest', () => {
    let k: Kart = { ...kartAt(2 * TILE, middle, -Math.PI / 2), speed: RULES.topSpeed };
    let fx: Fx = NO_FX;
    let top = 0;
    for (let i = 0; i < 600 && fx.fall <= 0; i++) {
      ({ kart: k, fx } = stepFx(MAP, k, NONE, RULES.subStep, 1, fx));
      top = Math.max(top, k.speed);
    }
    expect(top).toBeCloseTo(RULES.topSpeed, 0);
    expect(fx.fall).toBe(RULES.fallTime);
    expect(k.speed).toBe(0);
    expect(tileAt(MAP, Math.floor(k.x / TILE), Math.floor(k.y / TILE))).toBe('~');
  });

  it('reads a tile past the map\'s edge as the void', () => {
    let k: Kart = { ...kartAt(1.5 * TILE, middle, Math.PI), speed: 100 };
    let fx: Fx = NO_FX;
    for (let i = 0; i < 600 && fx.fall <= 0; i++) ({ kart: k, fx } = stepFx(MAP, k, NONE, RULES.subStep, 1, fx));
    expect(fx.fall).toBe(RULES.fallTime);
    expect(k.x).toBeLessThan(0);
  });
});

describe('the pad', () => {
  it('reads ◀ ▶, A and ▼ from the buttons held', () => {
    const held = (...a: Action[]) => padOf(new Set(a));
    expect(held()).toEqual(NONE);
    expect(held('left', 'a')).toEqual(pad({ left: true, accel: true }));
    expect(held('right', 'down')).toEqual(pad({ right: true, brake: true }));
    expect(held('up', 'start', 'select', 'b')).toEqual(NONE);
  });

  it('puts a kart on a starting place at rest', () => {
    expect(kartAt(1, 2, 3)).toEqual({ x: 1, y: 2, angle: 3, speed: 0, steer: 0 });
    expect(isRoad(tileAt(MAP, 3, 2))).toBe(true);
  });
});

// The fall into the void (PRD 1447, slice 2), on a small map drawn here: two tiles of road, void on both sides.
describe('the fall', () => {
  const VOID_MAP = ['~'.repeat(40), '#'.repeat(40), '#'.repeat(40), '~'.repeat(40)];
  const north = (speed = 80): Kart => ({ ...kartAt(20 * TILE, 2 * TILE + 8, -Math.PI / 2), speed });
  const held: Fx = { ...NO_FX, item: 'orb', boost: 1, spin: 0 };

  it('starts on the sub-step all of it has tipped over the edge, not while any of it is still over the road', () => {
    let k = north();
    let fx: Fx = held;
    let hung = false;
    for (let steps = 0; fx.fall <= 0 && steps < 500; steps++) {
      ({ kart: k, fx } = stepFx(VOID_MAP, k, pad({ accel: true }), RULES.subStep, 1, fx));
      if (fx.fall <= 0 && k.y < TILE) hung = true; // its centre over the void, the rest of it still on the road
    }
    expect(hung).toBe(true);
    expect(fx.fall).toBe(RULES.fallTime);
    expect(k.y).toBeLessThanOrEqual(TILE - RULES.overhang);
    expect(k.y).toBeGreaterThan(TILE - RULES.overhang - 2);
    expect(k.speed).toBe(0);
    expect(fx.boost).toBe(0);
    expect(fx.item).toBe('orb');
  });

  it('does not fall with its centre over the void while any of its width is still over the road', () => {
    for (const y of [TILE + 1, TILE - 1, TILE - RULES.overhang + 0.5]) {
      expect(stepFx(VOID_MAP, { ...north(0), y }, NONE, RULES.subStep, 1, NO_FX).fx.fall, `y ${y}`).toBe(0);
    }
  });

  it('measures the overhang to the nearest road, a corner of the road included', () => {
    // Road on the tiles of columns 0 to 2 of rows 1 and 2: its corner is at 48, 16, void all round it.
    const CORNER = ['~'.repeat(8), '###' + '~'.repeat(5), '###' + '~'.repeat(5), '~'.repeat(8)];
    const off = (d: number) => ({ x: 3 * TILE + d, y: TILE - d });
    expect(tippedOver(CORNER, off(4))).toBe(false); // 5.7 from the corner: still touching it
    expect(tippedOver(CORNER, off(5.5))).toBe(true); // 7.8 from it: gone
    expect(tippedOver(CORNER, { x: 3 * TILE + RULES.overhang - 0.5, y: 2 * TILE })).toBe(false);
    expect(tippedOver(CORNER, { x: 3 * TILE + RULES.overhang, y: 2 * TILE })).toBe(true);
    expect(tippedOver(CORNER, { x: TILE, y: 2 * TILE })).toBe(false);
  });

  it('ends a spin-out when it falls', () => {
    const k = { ...north(), y: TILE - RULES.overhang - 0.1 };
    const { fx } = stepFx(VOID_MAP, k, NONE, RULES.subStep, 1, { ...NO_FX, spin: 0.8 });
    expect(fx.fall).toBeGreaterThan(0);
    expect(fx.spin).toBe(0);
  });

  it('takes the pad and does not move the kart for a second, then says it landed', () => {
    let k = { ...north(), y: TILE - 2 };
    let fx: Fx = { ...held, fall: RULES.fallTime };
    const where = { x: k.x, y: k.y, angle: k.angle };
    let landed = false;
    let t = 0;
    for (; !landed && t < 2; t += RULES.subStep) {
      ({ kart: k, fx, landed } = stepFx(VOID_MAP, k, pad({ accel: true, left: true }), RULES.subStep, 1, fx));
      expect(k).toMatchObject(where);
    }
    expect(t).toBeCloseTo(RULES.fallTime, 1);
    expect(fx.fall).toBe(0);
    expect(fx.item).toBe('orb');
  });

  it('runs the blink down once the kart is back', () => {
    const { fx } = stepFx(VOID_MAP, north(0), NONE, 0.1, 1, { ...NO_FX, blink: RULES.blinkTime });
    expect(fx.blink).toBeCloseTo(RULES.blinkTime - 0.1, 9);
  });
});
