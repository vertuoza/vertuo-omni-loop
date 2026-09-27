import { describe, expect, it } from 'vitest';
import { borrowedXp, demoEvents } from '@omni/galaxy';
import { demoXp } from './xp';

describe('the demo guest\'s XP', () => {
  const now = new Date('2026-09-25T10:00:00Z');

  it('is the demo world\'s highest-XP contributor\'s, computed from its events, with a level and the first game', () => {
    const top = borrowedXp(demoEvents(now), { now })!;
    expect(demoXp(now)).toEqual({ xp: top.xp, level: top.level, unlocked: top.unlocked });
    expect(top.level).toBeGreaterThanOrEqual(1);
    expect(top.unlocked).toContain('invaders');
  });
});
