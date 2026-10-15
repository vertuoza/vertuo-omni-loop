import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { sure } from '../test/sure';
import { LOOK, MARK_LIFE, MAX_MARKS, MAX_PARTICLES, marksOf, newParticles, spawnsOf, stepMarks, stepParticles, type Mark, type Spawn } from './fx';
import { newRace, press, step, type Race } from './race';
import { RULES } from './rules';

// The race's particles (PRD 1427, slice 7): pure, seeded, capped.
const at = { x: 100, y: 100 };
const NONE: ReadonlySet<Action> = new Set();

describe('the particles', () => {
  it('give the same particles for the same seed and the same steps, and other ones for another seed', () => {
    const run = (seed: number) => {
      let p = newParticles(seed);
      for (const s of [[{ kind: 'burst', ...at }], [], [{ kind: 'burst', ...at }], []] as Spawn[][]) p = stepParticles(p, s, 0.05);
      return p;
    };
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it('spawn a trail on a boost, a burst on a hit and a flash on a box', () => {
    for (const kind of ['trail', 'burst', 'flash'] as const) {
      const p = stepParticles(newParticles(1), [{ kind, ...at }], 0.05);
      expect(p.list).toHaveLength(LOOK[kind].count);
      expect(p.list.every((q) => q.kind === kind && q.x === at.x && q.y === at.y && q.age === 0)).toBe(true);
    }
  });

  it('move as they age, and are gone at the end of their life', () => {
    const born = stepParticles(newParticles(1), [{ kind: 'burst', ...at }], 0.05);
    const later = stepParticles(born, [], 0.1);
    expect(later.list).toHaveLength(born.list.length);
    expect(later.list.some((q, i) => { const b = born.list[i]; return !b || q.x !== b.x || q.y !== b.y; })).toBe(true);
    expect(later.list.every((q) => q.age === 0.1)).toBe(true);
    expect(stepParticles(born, [], LOOK.burst.life - 0.01).list).toHaveLength(born.list.length);
    expect(stepParticles(born, [], LOOK.burst.life).list).toHaveLength(0);
  });

  it('are never more than 64: a new one replaces the oldest', () => {
    let p = newParticles(3);
    for (let i = 0; i < 30; i++) p = stepParticles(p, [{ kind: 'burst', x: i, y: 0 }], 0.001);
    expect(p.list).toHaveLength(MAX_PARTICLES);
    // The newest burst is all there, and the first one is gone.
    expect(p.list.filter((q) => q.x < 1)).toHaveLength(0);
    expect(p.list.at(-1)?.x).toBeCloseTo(29, 0);
  });

  it('never rise through the floor', () => {
    let p = stepParticles(newParticles(5), [{ kind: 'burst', ...at }], 0.01);
    for (let i = 0; i < 20; i++) { p = stepParticles(p, [], 0.02); expect(p.list.every((q) => q.z >= 0)).toBe(true); }
  });
});

describe('what a step spawns', () => {
  const race = (): Race => step(press(newRace({ seed: 7 }), 'start').race, NONE, RULES.countdown + 0.05).race;
  const kinds = (spawns: readonly Spawn[]) => spawns.map((s) => s.kind);

  it('a burst where a racer was hit, the rival\'s place for a rival', () => {
    const r = race();
    const rival = r.rivals[1];
    expect(spawnsOf(r, r, [{ kind: 'hit', racer: 2, item: 'orb', spun: true }])).toEqual([{ kind: 'burst', x: rival?.kart.x, y: rival?.kart.y }]);
  });

  it('a flash where a box was taken, once, and not while it waits to come back', () => {
    const before = race();
    const box = before.items.boxes[0];
    if (!box) throw new Error('a circuit with no box');
    const taken: Race = { ...before, items: { ...before.items, boxes: before.items.boxes.map((b, i) => (i === 0 ? { ...b, back: 5 } : b)) } };
    expect(spawnsOf(before, taken, [{ kind: 'box', racer: 0 }])).toEqual([{ kind: 'flash', x: box.x, y: box.y }]);
    expect(kinds(spawnsOf(taken, taken, []))).toEqual([]);
  });

  it('a trail behind each racer on BOOST', () => {
    const r = race();
    const boosting: Race = { ...r, fx: { ...r.fx, boost: 1 } };
    const [trail] = spawnsOf(r, boosting, []);
    expect(trail?.kind).toBe('trail');
    expect(spawnsOf(r, r, [])).toEqual([]);
    // Behind: the kart faces `angle`, so the trail is on the opposite side of its position.
    const ahead = Math.cos(r.player.angle) * ((trail?.x ?? 0) - r.player.x) + Math.sin(r.player.angle) * ((trail?.y ?? 0) - r.player.y);
    expect(ahead).toBeLessThan(0);
  });
});

// PRD 1963, slice 8: what the player sees of the drift.
describe('the snow, the marks, the sparks, the wind and the smoke', () => {
  const race = (): Race => step(press(newRace({ seed: 7 }), 'start').race, NONE, RULES.countdown + 0.05).race;
  const fast = RULES.topSpeed * 0.8;
  const kinds = (spawns: readonly Spawn[]) => spawns.map((s) => s.kind);
  const driving = (over: Partial<Race['player']>, fx: Partial<Race['fx']> = {}): Race => { const r = race(); return { ...r, player: { ...r.player, ...over }, fx: { ...r.fx, ...fx } }; };

  it('throws snow only on powder and above 0.6 of the top speed', () => {
    const r = driving({ speed: fast });
    expect(kinds(spawnsOf(r, r, [], () => 'powder'))).toEqual(['snow']);
    expect(spawnsOf(r, r, [], () => 'road')).toEqual([]);
    expect(spawnsOf(r, r, [], () => 'ice')).toEqual([]);
    const slow = driving({ speed: RULES.draftMin * RULES.topSpeed * 0.9 });
    expect(spawnsOf(slow, slow, [], () => 'powder')).toEqual([]);
  });

  it('throws blue sparks once the charge is blue, orange once it is orange, from both rear wheels', () => {
    expect(spawnsOf(race(), driving({ speed: fast }, { drift: 1, charge: RULES.chargeBlue - 0.01 }), [])).toEqual([]);
    expect(kinds(spawnsOf(race(), driving({ speed: fast }, { drift: 1, charge: RULES.chargeBlue }), []))).toEqual(['blue', 'blue']);
    expect(kinds(spawnsOf(race(), driving({ speed: fast }, { drift: 1, charge: RULES.chargeOrange }), []))).toEqual(['orange', 'orange']);
  });

  it('throws the sparks from the rear wheels where the kart is drawn: under its middle, one each side (issue 2057)', () => {
    const k = { x: 300, y: 200, angle: 0.7 };
    const sparks = spawnsOf(race(), driving({ speed: fast, ...k }, { drift: 1, charge: RULES.chargeBlue }), []);
    const ahead = (s: Spawn) => (s.x - k.x) * Math.cos(k.angle) + (s.y - k.y) * Math.sin(k.angle);
    const aside = (s: Spawn) => (s.y - k.y) * Math.cos(k.angle) - (s.x - k.x) * Math.sin(k.angle);
    // Not behind it: the camera sits so close behind the player's kart that a spark born behind it starts under the kart or off the screen.
    expect(sparks.map(ahead)).toEqual([expect.closeTo(0), expect.closeTo(0)]);
    const [one, other] = sparks.map(aside);
    expect(Math.abs(sure(one, 'a wheel'))).toBeGreaterThan(0);
    expect(sure(other, 'the other wheel')).toBeCloseTo(-sure(one, 'a wheel'));
  });

  it('streams wind while a slipstream builds, and smoke on a stall', () => {
    expect(kinds(spawnsOf(race(), driving({ speed: fast }, { draft: 0.5 }), []))).toEqual(['wind']);
    const r = race();
    expect(kinds(spawnsOf(r, { ...r, stall: 0.3 }, []))).toEqual(['smoke']);
  });

  it('throws nothing from a kart in the air or falling', () => {
    expect(spawnsOf(race(), driving({ speed: fast }, { drift: 1, charge: 2, hop: 0.1 }), [], () => 'powder')).toEqual([]);
    expect(spawnsOf(race(), driving({ speed: fast }, { drift: 1, charge: 2, fall: 0.5 }), [], () => 'powder')).toEqual([]);
  });

  it('keeps every kind under the particle cap of today', () => {
    let p = newParticles(2);
    for (let i = 0; i < 200; i++) p = stepParticles(p, [{ kind: 'snow', ...at }, { kind: 'blue', ...at }, { kind: 'wind', ...at }, { kind: 'smoke', ...at }], 0.01);
    expect(p.list.length).toBeLessThanOrEqual(MAX_PARTICLES);
  });

  it('leaves marks only over the 0.15 rad gap or in a drift, pale off the road and dark on it', () => {
    expect(marksOf(driving({ speed: fast }))).toEqual([]);
    expect(marksOf(driving({ speed: fast, angle: 0, travel: RULES.skidGap - 0.01 }))).toEqual([]);
    const slide = driving({ speed: fast, angle: 0, travel: RULES.skidGap + 0.05 });
    expect(marksOf(slide)).toHaveLength(2);
    expect(marksOf(slide).every((m) => !m.pale)).toBe(true);
    expect(marksOf(slide, () => 'ice').every((m) => m.pale)).toBe(true);
    expect(marksOf(slide, () => 'powder').every((m) => m.pale)).toBe(true);
    expect(marksOf(driving({ speed: fast }, { drift: -1, charge: 0 }))).toHaveLength(2);
    expect(marksOf(driving({ speed: fast, angle: 0, travel: 1 }, { hop: 0.1 }))).toEqual([]);
  });

  it('fades marks out over 3 seconds and keeps at most MAX_MARKS, the oldest going first', () => {
    let m = stepMarks([], [{ x: 1, y: 1, pale: true }], 0.1);
    expect(m).toHaveLength(1);
    m = stepMarks(m, [], MARK_LIFE - 0.2);
    expect(m).toHaveLength(1);
    expect(stepMarks(m, [], 0.2)).toHaveLength(0);
    let many: Mark[] = [];
    for (let i = 0; i < MAX_MARKS + 20; i++) many = stepMarks(many, [{ x: i, y: 0, pale: false }], 0.001);
    expect(many).toHaveLength(MAX_MARKS);
    expect(many[0]?.x).toBe(20);
  });
});
