import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { driveKart, kartAt, padOf, topSpeedAt, turnRate, type Kart, type Pad } from './kart';
import { RULES } from './rules';
import { isRoad, TILE, tileAt } from './track';

// The kart's own rules (PRD 1359, slice 2): speed, steering, grass and walls, on small hand-drawn maps
// so each rule is proved alone.

const NONE: Pad = { left: false, right: false, accel: false, brake: false };
const pad = (p: Partial<Pad>): Pad => ({ ...NONE, ...p });

// A road three tiles wide running east, grass beside it, and a wall at its end.
const MAP = [
  'X'.repeat(40),
  '.'.repeat(40),
  '#'.repeat(40),
  '#'.repeat(40),
  '#'.repeat(40),
  '.'.repeat(40),
  'X'.repeat(40),
] as const;
const middle = 3.5 * TILE;
const play = (k: Kart, p: Pad, seconds: number, map: readonly string[] = MAP, dt = RULES.subStep): Kart => {
  let out = k;
  for (let t = 0; t < seconds; t += dt) out = driveKart(map, out, p, dt);
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
    const k = play(rolling(-RULES.reverseSpeed, Math.PI), NONE, 3, MAP);
    expect(k.speed).toBe(0);
  });

  it('brakes with ▼ down to a stop, then reverses once stopped, up to the reverse speed', () => {
    let k = rolling(RULES.topSpeed);
    let stoppedAt = -1;
    for (let i = 0; i < 600; i++) {
      k = driveKart(MAP, k, pad({ brake: true }), RULES.subStep);
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
    expect(driveKart(MAP, rolling(-1, Math.PI), pad({ accel: true }), 0.01).speed).toBe(0);
  });

  it('moves the way it faces, at its speed', () => {
    const k = driveKart(MAP, rolling(60), NONE, 0.01);
    expect(k.x).toBeGreaterThan(20 * TILE);
    expect(k.y).toBeCloseTo(middle, 5);
    const back = driveKart(MAP, rolling(-30), NONE, 0.01);
    expect(back.x).toBeLessThan(20 * TILE);
  });
});

describe('steering', () => {
  it('does not turn a kart at rest', () => {
    expect(turnRate(0)).toBe(0);
    const k = driveKart(MAP, kartAt(3 * TILE, middle, 0.3), pad({ left: true }), 0.1);
    expect(k.angle).toBe(0.3);
  });

  it('turns right with ▶ and left with ◀ (the angle runs clockwise, y down)', () => {
    expect(driveKart(MAP, rolling(40), pad({ right: true }), 0.05).angle).toBeGreaterThan(0);
    expect(driveKart(MAP, rolling(40), pad({ left: true }), 0.05).angle).toBeLessThan(0);
    expect(driveKart(MAP, rolling(40), pad({ left: true, right: true }), 0.05).angle).toBe(0);
  });

  it('turns a fast kart less than a slow one', () => {
    expect(turnRate(RULES.gripSpeed)).toBeGreaterThan(turnRate(RULES.topSpeed));
    expect(turnRate(RULES.topSpeed)).toBeCloseTo(RULES.steer * RULES.steerAtTop, 10);
    expect(turnRate(RULES.gripSpeed / 2)).toBeLessThan(turnRate(RULES.gripSpeed));
    expect(turnRate(-RULES.gripSpeed)).toBe(turnRate(RULES.gripSpeed));
  });

  it('steers the other way when reversing', () => {
    expect(driveKart(MAP, rolling(-30), pad({ right: true }), 0.05).angle).toBeLessThan(0);
  });

  it('leans the kart into the turn it is steered', () => {
    expect(driveKart(MAP, rolling(40), pad({ right: true }), 0.01).steer).toBe(1);
    expect(driveKart(MAP, rolling(40), pad({ left: true }), 0.01).steer).toBe(-1);
    expect(driveKart(MAP, rolling(40), NONE, 0.01).steer).toBe(0);
  });
});

describe('grass', () => {
  it('halves the top speed', () => {
    expect(topSpeedAt(MAP, 3 * TILE, middle)).toBe(RULES.topSpeed);
    expect(topSpeedAt(MAP, 3 * TILE, 1.5 * TILE)).toBe(RULES.topSpeed / 2);
    const k = play({ ...kartAt(2 * TILE, 5.5 * TILE, 0), speed: 0 }, pad({ accel: true }), 1.2);
    expect(k.speed).toBeCloseTo(RULES.topSpeed / 2, 5);
  });

  it('slows a kart that drives onto it down to the grass top speed', () => {
    const k = play({ ...kartAt(2 * TILE, 5.5 * TILE, 0), speed: RULES.topSpeed }, pad({ accel: true }), 1);
    expect(k.speed).toBeCloseTo(RULES.topSpeed / 2, 5);
  });
});

describe('walls', () => {
  it('stops the speed going into a wall and bounces the kart back off it', () => {
    const north = { ...kartAt(3 * TILE, 3 * TILE, -Math.PI / 2), speed: 100 };
    const hit = play(north, NONE, 1, ['XXXXXXXXXXXXXXXX', ...MAP.slice(1)]);
    expect(hit.speed).toBeLessThanOrEqual(0);
    expect(hit.speed).toBeGreaterThanOrEqual(-RULES.bounce * 100 - 1e-6);
    expect(hit.y).toBeGreaterThanOrEqual(1 * TILE + RULES.radius - 1e-6);
  });

  it('keeps a glancing kart moving along the wall, a part of its speed lost', () => {
    const glance = { ...kartAt(2 * TILE, 2 * TILE + RULES.radius + 0.5, -0.1), speed: 100 };
    const k = play(glance, NONE, 0.05, ['XXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXX', ...MAP.slice(2)], 1 / 120);
    expect(k.speed).toBeGreaterThan(50);
    expect(k.speed).toBeLessThan(100);
    expect(k.y).toBeGreaterThanOrEqual(2 * TILE + RULES.radius - 1e-6);
  });

  it('pushes a kart that stands inside a wall out of it', () => {
    for (const y of [0.1, 0.5, 0.9]) {
      const k = driveKart(MAP, kartAt(5 * TILE, y * TILE, 0), NONE, 0.01);
      expect(tileAt(MAP, Math.floor(k.x / TILE), Math.floor(k.y / TILE)), `y ${y}`).not.toBe('X');
      expect(k.y).toBeGreaterThanOrEqual(1 * TILE + RULES.radius - 1e-6);
    }
  });

  it('never ends up inside or beyond a wall at top speed with 50 ms steps, whatever it is steered', () => {
    const patterns: Pad[][] = [
      [pad({ accel: true })],
      [pad({ accel: true, left: true })],
      [pad({ accel: true, right: true })],
      [pad({ accel: true, right: true }), pad({ accel: true, left: true }), pad({ accel: true })],
    ];
    for (const [n, steering] of patterns.entries()) {
      let k: Kart = { ...kartAt(2 * TILE, middle, 0.4 * n), speed: RULES.topSpeed };
      for (let i = 0; i < 1200; i++) {
        // The race plays a 50 ms frame as sub-steps; so does this.
        const p = steering[Math.floor(i / 7) % steering.length] ?? NONE;
        for (let s = 0; s < 6; s++) k = driveKart(MAP, k, p, 0.05 / 6);
        expect(tileAt(MAP, Math.floor(k.x / TILE), Math.floor(k.y / TILE)), `pattern ${n}, frame ${i}`).not.toBe('X');
        expect(k.x).toBeGreaterThan(0);
        expect(k.x).toBeLessThan(MAP[0].length * TILE);
      }
    }
  });

  it('reads a tile past the map\'s edge as a wall', () => {
    const k = play({ ...kartAt(1.5 * TILE, middle, Math.PI), speed: 100 }, NONE, 1, MAP);
    expect(k.x).toBeGreaterThanOrEqual(RULES.radius - 1e-6);
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
