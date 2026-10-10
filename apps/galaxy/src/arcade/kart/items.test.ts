import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { itemFor, newWorld, stepItems as step, spendItem, wantsToUse, weights, type Item, type Racer, type World } from './items';
import { kartAt, NO_FX, stepFx, type Fx } from './kart';
import { hudOf, newRace, press, step as stepRace, type Race } from './race';
import { RULES } from './rules';
import { parseTrack } from './track';

// The items (PRD 1359, slice 5): the boxes, the draw, BOOST, BLOB, ORB, the spin-out and the rivals' rules.

const track = parseTrack();
const NONE: ReadonlySet<Action> = new Set();
const HANDS = { left: false, right: false, accel: false, brake: false };
const { line, heading } = track;
const racer = (x = line.x, y = line.y, fx: Partial<Fx> = {}, angle = heading): Racer => ({ kart: kartAt(x, y, angle), fx: { ...NO_FX, ...fx } });
const empty = (w: World): World => ({ ...w, boxes: w.boxes.map((b) => ({ ...b, back: 99 })) });
const box = track.boxes[0] ?? { x: 0, y: 0 };
const onBox = (fx: Partial<Fx> = {}): Racer => racer(box.x, box.y, fx);
const world = () => newWorld(track, 5);

describe('the item boxes', () => {
  it('stand as two rows of four, all present at the start', () => {
    expect(world().boxes).toHaveLength(8);
    expect(world().boxes.every((b) => b.back === 0)).toBe(true);
  });

  it('give one item to a kart holding none, then disappear for 3 seconds and come back', () => {
    const a = step(track.map, world(), [onBox()], [3], 0.01);
    expect(a.racers[0]?.fx.item).not.toBeNull();
    const taken = a.world.boxes.filter((b) => b.back > 0);
    expect(taken).toHaveLength(1);
    expect(taken[0]?.back).toBe(RULES.boxBack);
    const b = step(track.map, a.world, [onBox()], [3], 0.01);
    expect(b.racers[0]?.fx.item).toBeNull();
    const back = step(track.map, a.world, [], [], RULES.boxBack);
    expect(back.world.boxes.every((x) => x.back === 0)).toBe(true);
    expect(step(track.map, back.world, [onBox()], [3], 0.01).racers[0]?.fx.item).not.toBeNull();
  });

  it('give nothing to a kart that already holds an item, and the box stays', () => {
    const a = step(track.map, world(), [onBox({ item: 'orb' })], [3], 0.01);
    expect(a.racers[0]?.fx.item).toBe('orb');
    expect(a.world.boxes.every((b) => b.back === 0)).toBe(true);
  });

  it('give nothing to a kart that is away from them', () => {
    expect(step(track.map, world(), [racer()], [3], 0.01).racers[0]?.fx.item).toBeNull();
  });
});

describe('the draw', () => {
  it('follows the seed: the same seed draws the same items, another seed does not', () => {
    const draws = (seed: number) => {
      let w = newWorld(track, seed);
      const got: (Item | null)[] = [];
      for (const b of track.boxes) { const r = step(track.map, w, [racer(b.x, b.y)], [3], 0.01); w = r.world; got.push(r.racers[0]?.fx.item ?? null); }
      return got;
    };
    expect(draws(11)).toEqual(draws(11));
    expect([1, 2, 3, 4, 5, 6, 7].map(draws).some((d) => d.join() !== draws(11).join())).toBe(true);
  });

  it('is weighted by place: the leaders draw more BLOBs, the karts behind more BOOSTs and ORBs', () => {
    expect(weights(1).blob).toBeGreaterThan(weights(6).blob);
    expect(weights(6).boost).toBeGreaterThan(weights(1).boost);
    expect(weights(6).orb).toBeGreaterThan(weights(1).orb);
    const share = (place: number, item: Item) => Array.from({ length: 1000 }, (_, i) => itemFor(place, i / 1000)).filter((x) => x === item).length;
    expect(share(1, 'blob')).toBeGreaterThan(share(6, 'blob'));
    expect(share(6, 'boost')).toBeGreaterThan(share(1, 'boost'));
    expect(share(6, 'orb')).toBeGreaterThan(share(1, 'orb'));
  });
});

describe('BOOST', () => {
  it('lasts 1.5 seconds at 1.4 times the top speed', () => {
    const used = spendItem(world(), racer(line.x, line.y, { item: 'boost' })).racer;
    expect(used.fx).toMatchObject({ item: null, boost: RULES.boostTime });
    let k: Racer = { kart: { ...used.kart, speed: RULES.topSpeed }, fx: used.fx };
    for (let t = 0; t < RULES.boostTime - 1e-9; t += 1 / 60) {
      const s = stepFx(track.map, k.kart, HANDS, 1 / 60, 1, k.fx);
      k = { kart: { ...s.kart, x: line.x, y: line.y }, fx: s.fx };
    }
    expect(k.kart.speed).toBeCloseTo(RULES.topSpeed * RULES.boostFactor, 0);
    expect(k.fx.boost).toBeLessThan(0.02);
  });

  it('works on grass too: faster than the road\'s top speed where the grass would halve it', () => {
    const open = ['................', '................', '................', '................'];
    const run = (fx: Fx) => {
      let k: Racer = { kart: { ...kartAt(32, 32, 0), speed: RULES.topSpeed }, fx };
      for (let i = 0; i < 90; i++) {
        const s = stepFx(open, k.kart, { ...HANDS, accel: true }, 0.01, 1, k.fx);
        k = { kart: { ...s.kart, x: 32, y: 32 }, fx: s.fx };
      }
      return k.kart.speed;
    };
    expect(run(NO_FX)).toBeLessThanOrEqual(RULES.topSpeed * RULES.grassFactor + 1e-9);
    expect(run({ ...NO_FX, boost: 99 })).toBeGreaterThan(RULES.topSpeed);
  });
});

describe('BLOB', () => {
  it('lands behind the kart, spins out the first kart over it, and is gone', () => {
    const dropped = spendItem(empty(world()), racer(line.x, line.y, { item: 'blob' }));
    const [blob] = dropped.world.blobs;
    expect(blob).toBeDefined();
    if (!blob) return;
    expect(Math.hypot(blob.x - line.x, blob.y - line.y)).toBeCloseTo(RULES.blobBehind, 5);
    expect((blob.x - line.x) * Math.cos(heading) + (blob.y - line.y) * Math.sin(heading)).toBeLessThan(0);
    const over: Racer = { kart: { ...kartAt(blob.x, blob.y, heading), speed: 100 }, fx: NO_FX };
    const after = step(track.map, dropped.world, [dropped.racer, over], [1, 2], 0.01);
    expect(after.racers[1]?.fx.spin).toBe(RULES.spinTime);
    expect(after.racers[1]?.kart.speed).toBeCloseTo(100 * RULES.spinSpeed, 5);
    expect(after.racers[0]?.fx.spin).toBe(0);
    expect(after.world.blobs).toHaveLength(0);
  });

  it('lets only the first kart over it spin out when two are on it', () => {
    const w: World = { ...empty(world()), blobs: [{ x: line.x, y: line.y }] };
    const after = step(track.map, w, [racer(), racer()], [1, 2], 0.01);
    expect(after.racers.map((r) => r.fx.spin > 0)).toEqual([true, false]);
  });

  it('lies at most six at a time: a seventh removes the oldest', () => {
    let w = empty(world());
    const xs: number[] = [];
    for (let i = 0; i < 7; i++) {
      w = spendItem(w, racer(line.x + i * 40, line.y, { item: 'blob' }, 0)).world;
      xs.push(line.x + i * 40 - RULES.blobBehind);
    }
    expect(w.blobs).toHaveLength(RULES.blobMax);
    expect(w.blobs.map((b) => b.x)).toEqual(xs.slice(1));
  });
});

describe('ORB', () => {
  it('flies straight ahead at twice the top speed from just in front of the kart', () => {
    const thrown = spendItem(empty(world()), racer(line.x, line.y, { item: 'orb' }));
    const [orb] = thrown.world.orbs;
    expect(orb).toBeDefined();
    if (!orb) return;
    expect(Math.hypot(orb.x - line.x, orb.y - line.y)).toBeCloseTo(RULES.orbAhead, 5);
    const flown = step(track.map, thrown.world, [], [], 0.05).world.orbs[0];
    expect(flown && Math.hypot(flown.x - orb.x, flown.y - orb.y)).toBeCloseTo(RULES.topSpeed * RULES.orbSpeed * 0.05, 5);
    expect(flown?.angle).toBeCloseTo(heading, 5);
  });

  it('bounces off walls, and is gone at its third bounce', () => {
    let w: World = { ...empty(world()), orbs: [{ x: line.x, y: line.y, angle: heading + Math.PI / 2, bounces: 0, age: 0 }] };
    const seen = new Set<number>();
    let steps = 0;
    while (w.orbs.length && steps++ < 5000) {
      w = step(track.map, w, [], [], 1 / 120).world;
      for (const o of w.orbs) seen.add(o.bounces);
    }
    expect(w.orbs).toHaveLength(0);
    expect([...seen].sort()).toEqual([0, 1, 2]);
    expect(steps / 120).toBeLessThan(RULES.orbLife);
  });

  it('is gone after 4 seconds', () => {
    const w: World = { ...empty(world()), orbs: [{ x: line.x, y: line.y, angle: heading, bounces: 0, age: RULES.orbLife - 0.01 }] };
    expect(step(track.map, w, [], [], 0.005).world.orbs).toHaveLength(1);
    expect(step(track.map, w, [], [], 0.02).world.orbs).toHaveLength(0);
  });

  it('spins out the kart it hits, and is gone', () => {
    let r = racer(line.x + Math.cos(heading) * 30, line.y + Math.sin(heading) * 30);
    let w = spendItem(empty(world()), racer(line.x, line.y, { item: 'orb' })).world;
    for (let i = 0; i < 60 && w.orbs.length; i++) { const s = step(track.map, w, [r], [2], 1 / 120); w = s.world; r = s.racers[0] ?? r; }
    expect(r.fx.spin).toBeGreaterThan(0);
    expect(w.orbs).toHaveLength(0);
  });
});

describe('the spin-out', () => {
  it('lasts a second at 30% of the speed, takes no input, turns the kart on itself, and never stops the race', () => {
    const fast: Racer = { kart: { ...kartAt(line.x, line.y, heading), speed: 100 }, fx: NO_FX };
    const hit = step(track.map, { ...empty(world()), blobs: [{ x: line.x, y: line.y }] }, [fast], [1], 0.01).racers[0];
    expect(hit?.kart.speed).toBeCloseTo(30, 5);
    let k = hit ?? fast;
    let turned = 0;
    for (let t = 0; t < RULES.spinTime - 1e-9; t += 0.01) {
      const s = stepFx(track.map, k.kart, { left: false, right: true, accel: true, brake: false }, 0.01, 1, k.fx);
      turned += s.kart.angle - k.kart.angle;
      expect(s.kart.speed).toBeLessThanOrEqual(k.kart.speed + 1e-9);
      k = { kart: { ...s.kart, x: line.x, y: line.y }, fx: s.fx };
    }
    expect(k.fx.spin).toBeLessThan(0.02);
    expect(turned).toBeGreaterThan(Math.PI);
    const s = stepFx(track.map, { ...k.kart, speed: 50 }, { ...HANDS, right: true }, 0.01, 1, { ...k.fx, spin: 0 });
    expect(s.kart.steer).toBe(1);
  });

  it('cannot use an item, and a kart already spinning is not hit again', () => {
    const spinning = racer(line.x, line.y, { item: 'boost', spin: 0.5 });
    expect(spendItem(world(), spinning).racer).toBe(spinning);
    const again = step(track.map, { ...empty(world()), blobs: [{ x: line.x, y: line.y }] }, [spinning], [1], 0.01).racers[0];
    expect(again?.fx.spin).toBe(0.5);
  });
});

describe('the rivals\' rules', () => {
  const at = (back: number, side = 0, fx: Partial<Fx> = {}): Racer => {
    const [c, s] = [Math.cos(heading), Math.sin(heading)];
    return racer(line.x - c * back - s * side, line.y - s * back + c * side, fx);
  };

  it('uses a BOOST at once on a straight, and not in a turn', () => {
    const me = racer(line.x, line.y, { item: 'boost' });
    expect(wantsToUse([me], 0, true)).toBe(true);
    expect(wantsToUse([me], 0, false)).toBe(false);
  });

  it('uses a BLOB when a kart is close behind, not when it is ahead or far', () => {
    const me = at(0, 0, { item: 'blob' });
    expect(wantsToUse([me, at(25)], 0, true)).toBe(true);
    expect(wantsToUse([me, at(-25)], 0, true)).toBe(false);
    expect(wantsToUse([me, at(200)], 0, true)).toBe(false);
    expect(wantsToUse([me], 0, true)).toBe(false);
  });

  it('uses an ORB when a kart is ahead, in range and roughly in line', () => {
    const me = at(0, 0, { item: 'orb' });
    expect(wantsToUse([me, at(-60)], 0, true)).toBe(true);
    expect(wantsToUse([me, at(-60, 40)], 0, true)).toBe(false);
    expect(wantsToUse([me, at(-400)], 0, true)).toBe(false);
    expect(wantsToUse([me, at(60)], 0, true)).toBe(false);
  });

  it('holds what it has when it is spinning or holds nothing', () => {
    expect(wantsToUse([at(0, 0, { item: 'boost', spin: 1 })], 0, true)).toBe(false);
    expect(wantsToUse([at(0)], 0, true)).toBe(false);
  });
});

describe('in the race', () => {
  const GAS: ReadonlySet<Action> = new Set<Action>(['a']);
  const go = (r: Race, seconds: number, held: ReadonlySet<Action> = NONE): Race => {
    let x = r;
    for (let t = 0; t < seconds - 1e-9; t += 0.05) x = stepRace(x, held, 0.05).race;
    return x;
  };
  const racing = (seed = 3): Race => go(press(newRace({ seed }), 'start').race, RULES.countdown + 0.05);

  it('uses the item held on B, and only while racing', () => {
    const r = { ...racing(), fx: { ...NO_FX, item: 'boost' as const } };
    expect(hudOf(r).run?.item).toBe('boost');
    const used = press(r, 'b').race;
    expect(used.fx).toMatchObject({ item: null, boost: RULES.boostTime });
    expect(hudOf(used).run?.item).toBeNull();
    expect(press(used, 'b').race.fx).toEqual(used.fx);
    const paused = press(r, 'start').race;
    expect(press(paused, 'b').race.fx.item).toBe('boost');
  });

  it('drops a BLOB behind the player on B, and throws an ORB ahead', () => {
    const r = { ...racing(), fx: { ...NO_FX, item: 'blob' as const } };
    expect(press(r, 'b').race.items.blobs).toHaveLength(1);
    expect(press({ ...r, fx: { ...NO_FX, item: 'orb' as const } }, 'b').race.items.orbs).toHaveLength(1);
  });

  it('gives the same race for the same seed and inputs, items included', () => {
    const play = (seed: number) => { const r = go(racing(seed), 40, GAS); return JSON.stringify([r.player, r.fx, r.items, r.rivals.map((x) => [x.kart, x.fx])]); };
    expect(play(9)).toBe(play(9));
    expect(play(9)).not.toBe(play(10));
  });

  it('lets the rivals take boxes and use what they hold over a race', () => {
    let r = racing(4);
    const held = new Set<Item>();
    let thrown = 0;
    for (let t = 0; t < 90; t += 0.05) {
      r = stepRace(r, GAS, 0.05).race;
      for (const x of r.rivals) if (x.fx?.item) held.add(x.fx.item);
      thrown = Math.max(thrown, r.items.blobs.length + r.items.orbs.length + r.rivals.filter((x) => (x.fx?.boost ?? 0) > 0).length);
    }
    expect(held.size).toBeGreaterThan(0);
    expect(thrown).toBeGreaterThan(0);
  });

  it('never stops the race for a spin-out', () => {
    const r = { ...racing(), fx: { ...NO_FX, spin: RULES.spinTime } };
    const later = go(r, 1.5, GAS);
    expect(later.phase).toBe('race');
    expect(later.fx.spin).toBe(0);
    expect(later.clock).toBeGreaterThan(r.clock + 1.4);
  });
});
