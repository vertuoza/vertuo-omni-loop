import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { LOOK, MAX_PARTICLES, newParticles, spawnsOf, stepParticles, type Spawn } from './fx';
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
