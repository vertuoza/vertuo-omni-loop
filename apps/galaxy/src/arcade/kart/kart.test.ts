import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { airborne, driveKart, endDrift, hopLift, kartAt, leanOf, NO_FX, padOf, stepFx, tippedOver, tipsOver, turnRate, wheelsOver, type Fx, type Kart, type Pad } from './kart';
import { RULES } from './rules';
import { sure } from '../test/sure';
import { cornersOf, groundOf, parseTrack, pointAtPx, roadAt, TILE, tileAt, type Ground } from './track';

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
const MAP_G = groundOf(MAP);
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
      ({ kart: k, fx } = stepFx(MAP_G, k, NONE, RULES.subStep, 1, fx));
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
    for (let i = 0; i < 600 && fx.fall <= 0; i++) ({ kart: k, fx } = stepFx(MAP_G, k, NONE, RULES.subStep, 1, fx));
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
    expect(held('start', 'select', 'b')).toEqual(NONE);
  });

  it('puts a kart on a starting place at rest', () => {
    expect(kartAt(1, 2, 3)).toEqual({ x: 1, y: 2, angle: 3, speed: 0, steer: 0 });
    expect(roadAt(MAP_G, 3 * TILE + 1, 2 * TILE + 1)).toBe(true);
  });
});

// The fall into the void (PRD 1447, slice 2), on a small map drawn here: two tiles of road, void on both sides.
describe('the fall', () => {
  const VOID_MAP = ['~'.repeat(40), '#'.repeat(40), '#'.repeat(40), '~'.repeat(40)];
  const VOID_G = groundOf(VOID_MAP);
  const north = (speed = 80): Kart => ({ ...kartAt(20 * TILE, 2 * TILE + 8, -Math.PI / 2), speed });
  const held: Fx = { ...NO_FX, item: 'orb', boost: 1, spin: 0 };

  it('starts on the sub-step all of it has tipped over the edge, not while any of it is still over the road', () => {
    let k = north();
    let fx: Fx = held;
    let hung = false;
    for (let steps = 0; fx.fall <= 0 && steps < 500; steps++) {
      ({ kart: k, fx } = stepFx(VOID_G, k, pad({ accel: true }), RULES.subStep, 1, fx));
      if (fx.fall <= 0 && k.y < TILE) hung = true; // its centre over the void, the rest of it still on the road
    }
    expect(hung).toBe(true);
    expect(fx.fall).toBe(RULES.fallTime);
    // Driving straight off the edge, it falls once its rear wheels pass it: the centre 6 past.
    expect(k.y).toBeLessThanOrEqual(TILE - RULES.wheelAlong);
    expect(k.y).toBeGreaterThan(TILE - RULES.wheelAlong - 2);
    expect(k.speed).toBe(0);
    expect(fx.boost).toBe(0);
    expect(fx.item).toBe('orb');
  });

  it('does not fall with its centre over the void while a rear wheel is still over the road', () => {
    for (const y of [TILE + 1, TILE - 1, TILE - RULES.wheelAlong + 0.5]) {
      expect(stepFx(VOID_G, { ...north(0), y }, NONE, RULES.subStep, 1, NO_FX).fx.fall, `y ${y}`).toBe(0);
    }
  });

  it('measures the overhang to the nearest road, a corner of the road included', () => {
    // Road on the tiles of columns 0 to 2 of rows 1 and 2: its corner is at 48, 16, void all round it.
    const CORNER = ['~'.repeat(8), '###' + '~'.repeat(5), '###' + '~'.repeat(5), '~'.repeat(8)];
    const CORNER_G = groundOf(CORNER);
    const off = (d: number) => ({ x: 3 * TILE + d, y: TILE - d });
    expect(tippedOver(CORNER_G, off(4))).toBe(false); // 5.7 from the corner: still touching it
    expect(tippedOver(CORNER_G, off(5.5))).toBe(true); // 7.8 from it: gone
    expect(tippedOver(CORNER_G, { x: 3 * TILE + RULES.overhang - 0.5, y: 2 * TILE })).toBe(false);
    expect(tippedOver(CORNER_G, { x: 3 * TILE + RULES.overhang, y: 2 * TILE })).toBe(true);
    expect(tippedOver(CORNER_G, { x: TILE, y: 2 * TILE })).toBe(false);
  });

  it('ends a spin-out when it falls', () => {
    const k = { ...north(), y: TILE - RULES.overhang - 0.1 };
    const { fx } = stepFx(VOID_G, k, NONE, RULES.subStep, 1, { ...NO_FX, spin: 0.8 });
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
      ({ kart: k, fx, landed } = stepFx(VOID_G, k, pad({ accel: true, left: true }), RULES.subStep, 1, fx));
      expect(k).toMatchObject(where);
    }
    expect(t).toBeCloseTo(RULES.fallTime, 1);
    expect(fx.fall).toBe(0);
    expect(fx.item).toBe('orb');
  });

  it('runs the blink down once the kart is back', () => {
    const { fx } = stepFx(VOID_G, north(0), NONE, 0.1, 1, { ...NO_FX, blink: RULES.blinkTime });
    expect(fx.blink).toBeCloseTo(RULES.blinkTime - 0.1, 9);
  });
});

describe('the slope on the top speed (PRD 1698)', () => {
  const GAS = pad({ accel: true });
  /** The speed after `seconds` at full gas on ground rising `slope` a unit ahead. */
  const topOn = (slope: number, seconds = 4): number => {
    let k = kartAt(20 * TILE, middle, 0);
    for (let t = 0; t < seconds; t += RULES.subStep) k = driveKart(k, GAS, RULES.subStep, 1, false, slope);
    return k.speed;
  };

  it('is the flat top speed on the level', () => {
    expect(topOn(0)).toBeCloseTo(RULES.topSpeed, 6);
  });

  it('lowers the top speed uphill and raises it downhill, by 1.2 times the slope', () => {
    expect(topOn(0.1)).toBeCloseTo(RULES.topSpeed * (1 - 0.12), 3);
    expect(topOn(-0.1)).toBeCloseTo(RULES.topSpeed * (1 + 0.12), 3);
    expect(RULES.climb).toBe(1.2);
  });

  it('never goes under 0.67 nor over 1.33 of the flat top speed', () => {
    expect(topOn(5)).toBeCloseTo(RULES.topSpeed * 0.67, 6);
    expect(topOn(-5)).toBeCloseTo(RULES.topSpeed * 1.33, 6);
  });

  it('slows a kart that is faster than the slope allows, down to what it allows', () => {
    let k: Kart = { ...kartAt(20 * TILE, middle, 0), speed: RULES.topSpeed };
    for (let t = 0; t < 2; t += RULES.subStep) k = driveKart(k, GAS, RULES.subStep, 1, false, 0.2);
    expect(k.speed).toBeCloseTo(RULES.topSpeed * (1 - 0.24), 3);
  });

  it('reaches stepFx too: the same hill is slower up than down', () => {
    const run = (slope: number): number => {
      let k = kartAt(5 * TILE, middle, 0), fx: Fx = NO_FX;
      for (let t = 0; t < 4; t += RULES.subStep) ({ kart: k, fx } = stepFx(MAP_G, k, GAS, RULES.subStep, 1, fx, slope));
      return k.speed;
    };
    expect(run(0.1)).toBeLessThan(run(0));
    expect(run(-0.1)).toBeGreaterThan(run(0));
    expect(run(0.1)).toBeLessThan(run(-0.1));
  });
});

describe('the four wheels (PRD 1698)', () => {
  // A road 20 tiles wide from the west, its edge at x = 320, void to the east of it.
  const EDGE = Array.from({ length: 6 }, () => '#'.repeat(20) + '~'.repeat(20));
  const EDGE_G = groundOf(EDGE);
  const y = 3 * TILE;
  const atEdge = (x: number, angle: number, speed = 0): Kart => ({ ...kartAt(x, y, angle), speed });
  const SE = Math.PI / 4;

  it('stands on four wheels, 6 ahead of and behind its centre and 3 to each side', () => {
    expect(RULES.wheelAlong).toBe(6);
    expect(RULES.wheelAcross).toBe(3);
    expect(wheelsOver(EDGE_G, atEdge(100, 0))).toEqual({ left: 0, right: 0 });
  });

  it('counts the wheels over the void on each side', () => {
    // Facing south-east: the front-left wheel is the first to go over the east edge, the rear-left the second.
    expect(wheelsOver(EDGE_G, atEdge(316, SE))).toEqual({ left: 1, right: 0 });
    expect(wheelsOver(EDGE_G, atEdge(322.5, SE))).toEqual({ left: 2, right: 1 });
    // Facing the edge head on, both front wheels are out, one on each side.
    expect(wheelsOver(EDGE_G, atEdge(316, 0))).toEqual({ left: 1, right: 1 });
  });

  it('leans towards the side with more wheels over the void, and not while the sides are level', () => {
    expect(leanOf(EDGE_G, atEdge(316, SE))).toBe(-0.5);
    expect(leanOf(EDGE_G, atEdge(322.5, SE))).toBe(-0.5);
    expect(leanOf(EDGE_G, atEdge(316, SE - Math.PI / 2))).toBe(0.5); // turned a quarter, the wheel out is on the other side
    expect(leanOf(EDGE_G, atEdge(316, 0))).toBe(0);
    expect(leanOf(EDGE_G, atEdge(100, 0))).toBe(0);
  });

  it('slides a leaning kart towards the void at 8 a second', () => {
    expect(RULES.tipPull).toBe(8);
    const before = atEdge(314.5, SE);
    const { kart, fx } = stepFx(EDGE_G, before, NONE, 0.1, 1, NO_FX);
    expect(fx.fall).toBe(0);
    expect(Math.hypot(kart.x - before.x, kart.y - before.y)).toBeCloseTo(0.8, 6);
    expect(kart.x).toBeGreaterThan(before.x); // the void is east
    // Level, it is not moved at all.
    expect(stepFx(EDGE_G, atEdge(100, SE), NONE, 0.1, 1, NO_FX).kart).toMatchObject({ x: 100, y });
  });

  it('lets the player steer back onto the road', () => {
    // Facing south, slightly west, its rear-left wheel is out: steering right turns it away from the void.
    let k = atEdge(316, 1.87, 40);
    let fx: Fx = NO_FX;
    expect(leanOf(EDGE_G, k)).not.toBe(0);
    for (let i = 0; i < 90; i++) ({ kart: k, fx } = stepFx(EDGE_G, k, pad({ right: true }), RULES.subStep, 1, fx));
    expect(fx.fall).toBe(0);
    expect(leanOf(EDGE_G, k)).toBe(0);
  });

  it('tips over once both wheels of one side have stayed over the void for 0.5 s in a row, into today\'s fall', () => {
    expect(RULES.tipGrace).toBe(0.5);
    expect(tipsOver(EDGE_G, atEdge(316, SE))).toBe(false);
    expect(tipsOver(EDGE_G, atEdge(322.5, SE))).toBe(true);
    expect(tipsOver(EDGE_G, atEdge(316, 0))).toBe(false);
    // Held there (the same kart each step): no fall at 0.49 s, a fall at 0.5 s.
    const held = atEdge(322.5, SE);
    let fx: Fx = { ...NO_FX, item: 'orb', boost: 1 };
    for (let i = 0; i < 49; i++) { fx = stepFx(EDGE_G, held, NONE, 0.01, 1, { ...fx, boost: 1 }).fx; expect(fx.fall).toBe(0); }
    expect(fx.tip).toBeCloseTo(0.49, 6);
    const end = stepFx(EDGE_G, held, NONE, 0.01, 1, fx);
    expect(end.fx.fall).toBe(RULES.fallTime);
    expect(end.kart.speed).toBe(0);
    expect(end.fx.boost).toBe(0);
    expect(end.fx.item).toBe('orb');
    expect(end.fx.tip).toBe(0);
  });

  it('starts the count again from 0 when one wheel is back over the road', () => {
    const held = atEdge(322.5, SE);
    let fx = stepFx(EDGE_G, held, NONE, 0.4, 1, NO_FX).fx;
    expect(fx.tip).toBeCloseTo(0.4, 6);
    fx = stepFx(EDGE_G, atEdge(316, SE), NONE, 0.01, 1, fx).fx; // only one wheel out
    expect(fx.tip).toBe(0);
    fx = stepFx(EDGE_G, held, NONE, 0.4, 1, fx).fx; // a later count starts from 0
    expect(fx.tip).toBeCloseTo(0.4, 6);
    expect(fx.fall).toBe(0);
  });

  it('still falls with its centre 7 past the edge, whichever way it faces', () => {
    // Round a convex corner of the road, wheels can all sit on road tiles while the centre is far from any: the centre rule keeps its fall.
    for (const angle of [-Math.PI / 2, 0, SE]) {
      const k = { ...kartAt(320 + RULES.overhang, y, angle), speed: 0 };
      expect(tippedOver(EDGE_G, k)).toBe(true);
      expect(stepFx(EDGE_G, k, NONE, RULES.subStep, 1, NO_FX).fx.fall).toBe(RULES.fallTime);
    }
  });
});

// Boost pads and jumps (PRD 1775, slice 4): on a fixture road, a pad at column 10 and a ramp at column 14,
// road beyond the ramp or void beyond it.
const PAD_MAP = ['~'.repeat(40), '#'.repeat(10) + '+' + '#'.repeat(3) + '^' + '#'.repeat(25), '~'.repeat(40)] as const;
const PAD_G = groundOf(PAD_MAP);
const GAP_MAP = ['~'.repeat(40), '#'.repeat(10) + '+' + '#'.repeat(3) + '^' + '~'.repeat(3) + '#'.repeat(22), '~'.repeat(40)] as const;
const GAP_G = groundOf(GAP_MAP);
const lane = 1.5 * TILE;
const run = (map: Ground, k: Kart, fx: Fx, seconds: number, p: Pad = NONE, dt = RULES.subStep) => {
  let kart = k, f = fx;
  for (let t = 0; t < seconds; t += dt) ({ kart, fx: f } = stepFx(map, kart, p, dt, 1, f));
  return { kart, fx: f };
};

describe('the boost pad (PRD 1775)', () => {
  it('gives the BOOST on the ground, started again on every pad, and keeps the held item', () => {
    const k = { ...kartAt(10 * TILE + 2, lane, 0), speed: 80 };
    const { fx } = stepFx(PAD_G, k, NONE, RULES.subStep, 1, { ...NO_FX, item: 'blob', boost: 0.2 });
    expect(fx.boost).toBe(RULES.boostTime);
    expect(fx.item).toBe('blob');
  });

  it('gives nothing to a kart in the air', () => {
    const k = { ...kartAt(10 * TILE + 2, lane, 0), speed: 80, height: 5, lift: 10 };
    expect(stepFx(PAD_G, k, NONE, RULES.subStep, 1, NO_FX).fx.boost).toBe(0);
  });
});

describe('the jump (PRD 1775)', () => {
  const onRamp = { ...kartAt(14 * TILE + 15.9, lane, 0), speed: 100 };

  it('takes off leaving a ramp forwards at 0.9 of the speed, and gravity brings it down', () => {
    const left = stepFx(PAD_G, onRamp, NONE, RULES.subStep, 1, NO_FX).kart;
    expect(left.lift).toBeCloseTo(RULES.launch * left.speed, 6);
    expect(airborne(left)).toBe(true);
    const next = stepFx(PAD_G, left, NONE, RULES.subStep, 1, NO_FX).kart;
    expect(next.lift).toBeCloseTo((left.lift ?? 0) - RULES.gravity * RULES.subStep, 6);
    expect(next.height ?? 0).toBeGreaterThan(0);
  });

  it('does not take off reversing', () => {
    const back = { ...kartAt(14 * TILE + 0.05, lane, 0), speed: -20 };
    expect(airborne(stepFx(PAD_G, back, NONE, 0.05, 1, NO_FX).kart)).toBe(false);
  });

  it('flies higher and farther the faster it goes', () => {
    const peak = (speed: number) => {
      let kart: Kart = { ...kartAt(14 * TILE + 15.9, lane, 0), speed };
      let fx = NO_FX, top = 0, steps = 0;
      do { ({ kart, fx } = stepFx(PAD_G, kart, NONE, RULES.subStep, 1, fx)); top = Math.max(top, kart.height ?? 0); steps++; } while (airborne(kart) && steps < 2000);
      return { top, far: kart.x };
    };
    expect(peak(100).top).toBeGreaterThan(peak(60).top);
    expect(peak(100).far).toBeGreaterThan(peak(60).far);
  });

  it('holds its speed in the air, steers at 0.3 of its turn rate and never tips over', () => {
    const k: Kart = { ...kartAt(5 * TILE, lane, 0), speed: 90, height: 10, lift: 50 };
    const flown = stepFx(PAD_G, k, pad({ left: true, brake: true }), 0.05, 1, NO_FX).kart;
    expect(flown.speed).toBe(90);
    expect(flown.angle).toBeCloseTo(-turnRate(90) * RULES.airSteer * 0.05, 6);
    const over = { ...k, x: 5 * TILE, y: 0.2 * TILE, height: 30, lift: 0 }; // over the void beside the road
    const held = stepFx(PAD_G, over, NONE, 0.02, 1, NO_FX);
    expect(held.fx.fall).toBe(0);
    expect(held.fx.tip).toBe(0);
  });

  it('lands on the road and drives on with its speed', () => {
    const { kart, fx } = run(PAD_G, onRamp, NO_FX, 1, pad({ accel: true }));
    expect(airborne(kart)).toBe(false);
    expect(kart.height).toBeUndefined();
    expect(fx.fall).toBe(0);
    expect(kart.speed).toBeGreaterThan(0);
  });

  it('lands with its centre over the void and falls by today\'s fall', () => {
    const { fx } = run(GAP_G, { ...onRamp, speed: 40 }, NO_FX, 3);
    expect(fx.fall).toBeGreaterThan(0);
  });

  it('lands with both wheels of one side over the void and the grace counts', () => {
    const edge = 1 * TILE - 2; // the row's top edge: the left wheels hang over the void
    const k: Kart = { ...kartAt(20 * TILE, edge, 0), speed: 60, height: 0.01, lift: -50 };
    const landed = stepFx(PAD_G, k, NONE, 0.02, 1, NO_FX);
    expect(airborne(landed.kart)).toBe(false);
    expect(landed.fx.tip).toBeCloseTo(0.02, 6);
    expect(landed.fx.fall).toBe(0);
  });
});

describe('the round edge of an arc (PRD 1829)', () => {
  const ring = parseTrack();
  const HALF = 2.5 * TILE;
  // The middle of the arc of waypoint 0, a point `out` px outside its centre line (the outside of the bend), and the way a kart runs there.
  const corner = sure(cornersOf(ring).find((c) => c.index === 0), 'the arc of waypoint 0');
  const mid = pointAtPx(ring, (corner.start + corner.length / 2) * TILE);
  const outward = corner.turn === 'left' ? { x: -mid.ty, y: mid.tx } : { x: mid.ty, y: -mid.tx };
  const beyond = (out: number): Kart => kartAt(mid.x + outward.x * out, mid.y + outward.y * out, Math.atan2(mid.ty, mid.tx));

  it('is where the road ends, as far from the centre line as half its width, all along the arc', () => {
    expect(roadAt(ring, beyond(HALF - 1).x, beyond(HALF - 1).y)).toBe(true);
    expect(roadAt(ring, beyond(HALF + 1).x, beyond(HALF + 1).y)).toBe(false);
  });

  it('tips a kart over once it is more than its overhang past the round edge, and not before', () => {
    expect(tippedOver(ring, beyond(HALF + RULES.overhang - 1))).toBe(false);
    expect(tippedOver(ring, beyond(HALF + RULES.overhang + 1))).toBe(true);
    expect(tippedOver(ring, beyond(HALF - 1))).toBe(false);
  });

  it('puts the wheels beyond the edge on the outside of the bend, and leans the kart that way', () => {
    const k = beyond(HALF + 1);
    expect(wheelsOver(ring, k)).toEqual(corner.turn === 'left' ? { left: 0, right: 2 } : { left: 2, right: 0 });
    expect(leanOf(ring, k)).toBe(corner.turn === 'left' ? 1 : -1);
    expect(wheelsOver(ring, beyond(0))).toEqual({ left: 0, right: 0 });
  });
});

// The surfaces (PRD 1923, slice 3): powder, ice and the tree line, on small maps with a floor (`i` ice, `p` powder, `#` road).
describe('the surfaces', () => {
  const field = (c: string, cols = 60, rows = 60) => groundOf(Array.from({ length: rows }, () => c.repeat(cols)));
  const powder = field('p'), ice = field('i');
  const gap = (k: Kart) => Math.abs(Math.atan2(Math.sin(k.angle - (k.travel ?? k.angle)), Math.cos(k.angle - (k.travel ?? k.angle))));
  const GAS = pad({ accel: true });
  const at = (x: number, y: number, angle = 0, speed = 0): Kart => ({ ...kartAt(x, y, angle), speed });

  it('caps the speed on powder at 0.55 of the top speed, and never tips the kart over', () => {
    const { kart, fx } = run(powder, at(3 * TILE, 30 * TILE), NO_FX, 6, GAS);
    expect(kart.speed).toBeCloseTo(RULES.topSpeed * RULES.powder, 3);
    expect(fx.fall).toBe(0);
    expect(tippedOver(powder, kart)).toBe(false);
    expect(tipsOver(powder, kart)).toBe(false);
  });

  it('tips over on the void, never on ice or powder', () => {
    const edge = groundOf(['~~~~~~~~~~', 'pppp~~~~~~', 'iiii~~~~~~']);
    expect(tippedOver(edge, { x: 8 * TILE, y: 1.5 * TILE })).toBe(true);
    expect(tippedOver(edge, { x: 2 * TILE, y: 1.5 * TILE })).toBe(false);
    expect(tippedOver(edge, { x: 2 * TILE, y: 2.5 * TILE })).toBe(false);
  });

  it('keeps the top speed on ice, and lets the path lag the nose while steering, by 1.0 radian at most, reaching it within a second', () => {
    let k = at(30 * TILE, 30 * TILE, 0, 60);
    const gaps: number[] = [];
    for (let t = 0; t < 1.5; t += RULES.subStep) {
      k = driveKart(k, pad({ accel: true, right: true }), RULES.subStep, 1, false, 0, ice);
      gaps.push(gap(k));
    }
    expect(gaps[40]).toBeGreaterThan(gaps[10] ?? 0);
    expect(Math.max(...gaps.slice(0, Math.round(1 / RULES.subStep)))).toBeGreaterThan(RULES.iceSlip - 0.01);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(RULES.iceSlip + 1e-9);
    expect(Math.max(...gaps)).toBeGreaterThan(RULES.iceSlip - 0.01);
    expect(driveKart(at(30 * TILE, 30 * TILE, 0, RULES.topSpeed), GAS, 0.1, 1, false, 0, ice).speed).toBe(RULES.topSpeed);
  });

  it('closes the gap at 0.4 radians a second once the wheel is straight', () => {
    let k = at(30 * TILE, 30 * TILE, 0, 60);
    for (let t = 0; t < 1.5; t += RULES.subStep) k = driveKart(k, pad({ accel: true, right: true }), RULES.subStep, 1, false, 0, ice);
    const before = gap(k);
    for (let t = 0; t < 0.1 - 1e-9; t += RULES.subStep) k = driveKart(k, GAS, RULES.subStep, 1, false, 0, ice);
    expect(before - gap(k)).toBeCloseTo(RULES.iceGrip * 0.1, 3);
  });

  it('acts the gas, the brake and the coast at 0.6, 0.4 and 0.3 of the road, reversing included', () => {
    const dv = (map: Ground | undefined, p: Pad, v: number) => Math.abs(driveKart(at(30 * TILE, 30 * TILE, 0, v), p, 0.1, 1, false, 0, map).speed - v);
    const road = undefined;
    expect(dv(ice, GAS, 20) / dv(road, GAS, 20)).toBeCloseTo(RULES.iceAccel, 6);
    expect(dv(ice, pad({ brake: true }), 20) / dv(road, pad({ brake: true }), 20)).toBeCloseTo(RULES.iceBrake, 6);
    expect(dv(ice, pad({}), 20) / dv(road, pad({}), 20)).toBeCloseTo(RULES.iceCoast, 6);
    expect(dv(ice, pad({ brake: true }), -30) / dv(road, pad({ brake: true }), -30)).toBeCloseTo(RULES.iceAccel, 6);
    expect(dv(ice, GAS, -30) / dv(road, GAS, -30)).toBeCloseTo(RULES.iceBrake, 6);
    expect(dv(ice, pad({}), -30) / dv(road, pad({}), -30)).toBeCloseTo(RULES.iceCoast, 6);
  });

  it('turns the travel back at 6 radians a second off the ice and drops it within 0.01 radian', () => {
    const road = undefined;
    const slid: Kart = { ...at(30 * TILE, 30 * TILE, 0, 20), travel: -0.5 };
    const one = driveKart(slid, pad({}), 0.01, 1, false, 0, road);
    expect((one.travel ?? 0) - -0.5).toBeCloseTo(RULES.grip * 0.01, 6);
    let k = slid;
    for (let t = 0; t < 0.1; t += RULES.subStep) k = driveKart(k, pad({}), RULES.subStep, 1, false, 0, road);
    expect(k.travel).toBeUndefined();
    expect(driveKart(at(30 * TILE, 30 * TILE, 0, 20), GAS, 0.1, 1, false, 0, road).travel).toBeUndefined();
  });

  it('travels the way it faces on road, and again once it leaves the ice', () => {
    const mixed = groundOf(Array.from({ length: 40 }, () => 'i'.repeat(20) + '#'.repeat(40)));
    let k = at(18 * TILE, 20 * TILE, 0, 60);
    for (let t = 0; t < 0.3; t += RULES.subStep) k = driveKart(k, pad({ accel: true, right: true }), RULES.subStep, 1, false, 0, mixed);
    expect(k.travel).toBeDefined();
    for (let t = 0; t < 1; t += RULES.subStep) {
      k = driveKart(k, GAS, RULES.subStep, 1, false, 0, mixed);
      if (k.x > 21 * TILE) break;
    }
    expect(k.travel).toBeUndefined();
  });

  it('stops a kart at the tree line, one tile inside the edge', () => {
    const { kart, fx } = run(powder, at(50 * TILE, 30 * TILE), NO_FX, 6, GAS);
    expect(kart.speed).toBe(0);
    expect(kart.x).toBeLessThan(powder.size.w - TILE);
    expect(kart.x).toBeGreaterThan(powder.size.w - TILE - 4);
    expect(fx.fall).toBe(0);
  });
});

describe('the hop and the drift (PRD 1963)', () => {
  const road = groundOf(Array.from({ length: 80 }, () => '#'.repeat(80)));
  const powder = groundOf(Array.from({ length: 80 }, () => 'p'.repeat(80)));
  const ice = groundOf(Array.from({ length: 80 }, () => 'i'.repeat(80)));
  const fast = (speed: number = RULES.topSpeed): Kart => ({ ...kartAt(10 * TILE, 40 * TILE, 0), speed });
  const HOP = pad({ accel: true, hop: true });
  const HOP_RIGHT = pad({ accel: true, hop: true, right: true });
  const GAS = pad({ accel: true });
  /** `seconds` of steps with `p`, returning the kart and its fx. */
  const go = (map: Ground, k: Kart, f: Fx, p: Pad, seconds: number) => {
    let kart = k, fx = f;
    for (let t = 0; t < seconds - 1e-9; t += RULES.subStep) ({ kart, fx } = stepFx(map, kart, p, RULES.subStep, 1, fx));
    return { kart, fx };
  };
  /** A drift to the right begun on road: hop, land with HOP and the right arrow held. */
  const drifting = (map: Ground = road, k: Kart = fast()) => go(map, k, NO_FX, HOP_RIGHT, RULES.hopTime + 0.02);

  it('hops 4 pixels over 0.25 seconds on HOP going down, and airborne stays false through it', () => {
    let k = fast(), fx: Fx = NO_FX, peak = 0;
    for (let t = 0; t < RULES.hopTime - 0.01; t += RULES.subStep) {
      ({ kart: k, fx } = stepFx(road, k, HOP, RULES.subStep, 1, fx));
      peak = Math.max(peak, hopLift(fx));
      expect(airborne(k)).toBe(false);
    }
    expect(peak).toBeCloseTo(RULES.hopHeight, 1);
    ({ kart: k, fx } = go(road, k, fx, GAS, 0.05));
    expect(hopLift(fx)).toBe(0);
  });

  it('does nothing for HOP in the air or during a hop, and needs HOP to go down again', () => {
    const up = stepFx(road, { ...fast(), height: 0, lift: 50 }, HOP, RULES.subStep, 1, NO_FX);
    expect(up.fx.hop).toBeUndefined();
    const hop = go(road, fast(), NO_FX, HOP, 0.1);
    const again = go(road, hop.kart, hop.fx, pad({ accel: true }), 0.03);
    const pressed = stepFx(road, again.kart, HOP, RULES.subStep, 1, again.fx);
    expect(pressed.fx.hop).toBeLessThan(again.fx.hop ?? 0);
  });

  it('starts a drift only on landing with HOP and an arrow held at half the top speed or more', () => {
    expect(drifting().fx.drift).toBe(1);
    expect(go(road, fast(), NO_FX, pad({ accel: true, hop: true, left: true }), 0.27).fx.drift).toBe(-1);
    expect(go(road, fast(), NO_FX, HOP, 0.27).fx.drift).toBeUndefined();
    expect(go(road, fast(RULES.topSpeed * 0.4), NO_FX, pad({ hop: true, right: true }), 0.27).fx.drift).toBeUndefined();
    const midHop = go(road, fast(), NO_FX, HOP, 0.1);
    expect(go(road, midHop.kart, midHop.fx, pad({ accel: true, right: true }), 0.2).fx.drift).toBeUndefined();
  });

  it('turns at 2.2, 1.5 and 0.9 radians a second with the drift\'s arrow, neither or the other', () => {
    const d = drifting();
    const rate = (p: Pad): number => {
      const one = stepFx(road, d.kart, p, 0.01, 1, d.fx);
      return (one.kart.angle - d.kart.angle) / 0.01;
    };
    expect(rate(pad({ accel: true, hop: true, right: true }))).toBeCloseTo(RULES.driftTight, 5);
    expect(rate(HOP)).toBeCloseTo(RULES.driftMid, 5);
    expect(rate(pad({ accel: true, hop: true, left: true }))).toBeCloseTo(RULES.driftWide, 5);
  });

  it('lets the nose lead the path by 0.45 radian at most, and by 1.0 on ice', () => {
    const lead = (map: Ground): number => {
      let { kart, fx } = drifting(map);
      let most = 0;
      for (let t = 0; t < 4; t += RULES.subStep) {
        ({ kart, fx } = stepFx(map, kart, HOP_RIGHT, RULES.subStep, 1, fx));
        most = Math.max(most, Math.abs(Math.atan2(Math.sin(kart.angle - (kart.travel ?? kart.angle)), Math.cos(kart.angle - (kart.travel ?? kart.angle)))));
      }
      return most;
    };
    expect(lead(road)).toBeGreaterThan(0.4);
    expect(lead(road)).toBeLessThanOrEqual(RULES.driftSlip + 1e-9);
    expect(lead(ice)).toBeGreaterThan(RULES.driftSlip);
    expect(lead(ice)).toBeLessThanOrEqual(RULES.iceSlip + 1e-9);
  });

  it('charges on road and ice and stands still on powder', () => {
    expect(go(road, drifting().kart, drifting().fx, HOP_RIGHT, 0.5).fx.charge).toBeCloseTo(0.5, 1);
    expect(go(ice, drifting(ice).kart, drifting(ice).fx, HOP_RIGHT, 0.5).fx.charge).toBeCloseTo(0.5, 1);
    const p = drifting(powder, fast(RULES.topSpeed * RULES.powder));
    expect(p.fx.drift).toBe(1);
    expect(go(powder, p.kart, p.fx, HOP_RIGHT, 0.5).fx.charge).toBe(0);
  });

  it('gives a BOOST of 0.5 and 1 second when HOP is let go at 0.8 and 1.8 seconds, and none under 0.8', () => {
    const released = (charged: number) => {
      const d = drifting();
      const c = go(road, d.kart, d.fx, HOP_RIGHT, charged);
      return stepFx(road, c.kart, GAS, RULES.subStep, 1, c.fx).fx;
    };
    expect(released(0.5).boost).toBe(0);
    expect(released(0.82).boost).toBeCloseTo(RULES.miniBlue, 1);
    expect(released(1.82).boost).toBeCloseTo(RULES.miniOrange, 1);
    expect(released(1.82).drift).toBeUndefined();
    expect(released(1.82).charge).toBeUndefined();
  });

  it('never shortens a BOOST already running', () => {
    const d = drifting();
    const c = go(road, d.kart, { ...d.fx, boost: 1.4 }, HOP_RIGHT, 0.85);
    expect(stepFx(road, c.kart, GAS, RULES.subStep, 1, { ...c.fx, boost: 1.4 }).fx.boost).toBeCloseTo(1.4 - RULES.subStep, 5);
  });

  it('loses the drift, with no turbo, on ▼, a spin-out, a fall, a tip-over, the speed under half, a ramp\'s jump', () => {
    const d = drifting();
    const c = go(road, d.kart, d.fx, HOP_RIGHT, 1.9);
    const lost = (k: Kart, f: Fx, p: Pad, m: Ground = road) => stepFx(m, k, p, RULES.subStep, 1, f).fx;
    const brake = lost(c.kart, c.fx, pad({ hop: true, brake: true }));
    expect(brake.drift).toBeUndefined();
    expect(brake.boost).toBe(0);
    expect(lost(c.kart, { ...c.fx, spin: 1 }, HOP_RIGHT).drift).toBeUndefined();
    expect(lost(c.kart, { ...c.fx, spin: 1 }, GAS).boost).toBe(0);
    expect(lost(c.kart, { ...c.fx, fall: 1 }, HOP_RIGHT).drift).toBeUndefined();
    expect(lost({ ...c.kart, speed: RULES.topSpeed * 0.4 }, c.fx, GAS).boost).toBe(0);
    expect(lost({ ...c.kart, speed: RULES.topSpeed * 0.4 }, c.fx, HOP_RIGHT).drift).toBeUndefined();
    expect(lost({ ...c.kart, height: 0, lift: 30 }, c.fx, HOP_RIGHT).drift).toBeUndefined();
    const edge = groundOf(Array.from({ length: 80 }, (_, i) => (i < 40 ? '#' : '~').repeat(80)));
    const over = lost({ ...c.kart, x: 40 * TILE, y: 41 * TILE + 8 }, c.fx, HOP_RIGHT, edge);
    expect(over.drift).toBeUndefined();
    expect(over.boost).toBe(0);
    const ramp = groundOf(Array.from({ length: 80 }, () => '#'.repeat(30) + '^' + '#'.repeat(49)));
    expect(lost({ ...c.kart, x: 30 * TILE + 15.9, y: 40 * TILE, angle: 0 }, c.fx, HOP_RIGHT, ramp).drift).toBeUndefined();
  });

  it('is ended, charge and all, by endDrift', () => {
    const d = go(road, drifting().kart, drifting().fx, HOP_RIGHT, 1);
    expect(endDrift(d.fx).drift).toBeUndefined();
    expect(endDrift(d.fx).charge).toBeUndefined();
  });

  it('leaves a kart that never hops with the fx it always had', () => {
    const { fx } = go(road, fast(), NO_FX, GAS, 1);
    expect(fx).toEqual({ ...NO_FX });
  });

  it('reads HOP from the up button', () => {
    expect(padOf(new Set<Action>(['up'])).hop).toBe(true);
    expect(padOf(new Set<Action>()).hop).toBeUndefined();
  });
});
