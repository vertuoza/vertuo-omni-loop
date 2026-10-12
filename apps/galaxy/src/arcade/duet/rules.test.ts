import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { orbs, RULES, turn, turnOf } from './rules';

// OMNI DUET's orbs (PRD 1633, slice 2): the constants block, and how ◀ ▶ turn the pair.

const held = (...actions: Action[]): ReadonlySet<Action> => new Set(actions);
const TURN = Math.PI * 2;

describe('the constants block', () => {
  it('holds the circle, the orbs and the turning speed', () => {
    expect(RULES.radius).toBe(56);
    expect(RULES.orbRadius).toBe(6);
    expect(RULES.turnsPerSecond).toBe(1.25);
    expect(RULES.field).toEqual({ w: 320, h: 288 });
    expect(RULES.subStep).toBe(1 / 60);
    expect(RULES.maxDt).toBe(0.05);
  });

  it('sits the circle\'s centre in the lower third of the playfield, the circle inside it', () => {
    const { x, y } = RULES.centre;
    expect(x).toBe(RULES.field.w / 2);
    expect(y).toBeGreaterThanOrEqual((RULES.field.h * 2) / 3);
    expect(y + RULES.radius + RULES.orbRadius).toBeLessThanOrEqual(RULES.field.h);
  });
});

describe('the turn', () => {
  it('reads ◀ as anticlockwise, ▶ as clockwise, and both or neither as still', () => {
    expect(turnOf(held('left'))).toBe(1);
    expect(turnOf(held('right'))).toBe(-1);
    expect(turnOf(held('left', 'right'))).toBe(0);
    expect(turnOf(held())).toBe(0);
    expect(turnOf(held('a', 'up', 'start'))).toBe(0);
  });

  it('turns the pair at 1.25 turns a second: a half turn in 0.4 s', () => {
    expect(turn(0, held('left'), 1)).toBeCloseTo(1.25 * TURN, 10);
    expect(turn(0, held('right'), 1)).toBeCloseTo(-1.25 * TURN, 10);
    expect(turn(1, held('left'), 0.5 / 1.25)).toBeCloseTo(1 + Math.PI, 10);
    expect(turn(1, held('left', 'right'), 1)).toBe(1);
    expect(turn(1, held(), 1)).toBe(1);
  });

  it('moves an orb anticlockwise on the screen under ◀: from the right of the centre to above it', () => {
    const [start] = orbs(0);
    const [after] = orbs(turn(0, held('left'), 0.25 / 1.25));
    expect(start.x).toBeCloseTo(RULES.centre.x + RULES.radius, 10);
    expect(start.y).toBeCloseTo(RULES.centre.y, 10);
    expect(after.x).toBeCloseTo(RULES.centre.x, 10);
    expect(after.y).toBeCloseTo(RULES.centre.y - RULES.radius, 10); // the screen's y grows downwards
    const [clock] = orbs(turn(0, held('right'), 0.25 / 1.25));
    expect(clock.y).toBeCloseTo(RULES.centre.y + RULES.radius, 10);
  });

  it('keeps the two orbs opposite each other on the circle, whatever the angle', () => {
    for (const angle of [0, 0.3, 1, Math.PI, 4.2, -2.5, 17]) {
      const [warm, cool] = orbs(angle);
      expect((warm.x + cool.x) / 2).toBeCloseTo(RULES.centre.x, 10);
      expect((warm.y + cool.y) / 2).toBeCloseTo(RULES.centre.y, 10);
      expect(Math.hypot(warm.x - RULES.centre.x, warm.y - RULES.centre.y)).toBeCloseTo(RULES.radius, 10);
      expect(Math.hypot(warm.x - cool.x, warm.y - cool.y)).toBeCloseTo(RULES.radius * 2, 10);
    }
  });
});
