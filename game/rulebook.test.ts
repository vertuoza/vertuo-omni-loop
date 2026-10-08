import { describe, it, expect } from 'vitest';
import { RULEBOOK } from './rulebook.ts';
import { xpForLevel } from './experience.ts';

describe('rulebook', () => {
  it('holds every constant the spec names', () => {
    expect(RULEBOOK.zoneSecured).toBe(10);
    expect(RULEBOOK.woundClose).toEqual({
      transmission: 5, 'unconfirmed-ground': 15, beacon: 25,
      'fault-line': 20, 'under-fire': 10, aftershock: 20,
    });
    expect(RULEBOOK.decayPerTranche).toEqual({
      transmission: 1, 'unconfirmed-ground': 3, beacon: 5,
      'fault-line': 3, 'under-fire': 3, aftershock: 5,
    });
    expect(RULEBOOK.classMultiplier(1)).toBe(1);
    expect(RULEBOOK.classMultiplier(4)).toBe(2.5);
    expect(RULEBOOK.classMultiplier(7)).toBe(2.5);
    expect(RULEBOOK.crossSectorMultiplier).toBe(1.25);
    expect(RULEBOOK.terraformOwner).toBe(100);
    expect(RULEBOOK.terraformExpedition).toBe(50);
    expect(RULEBOOK.terraformCloser).toBe(25);
    expect(RULEBOOK.streakStep).toBe(0.1);
    expect(RULEBOOK.streakCap).toBe(0.5);
    expect(RULEBOOK.crossTeamMultiplier).toBe(1.5);
    expect(RULEBOOK.nightShiftMultiplier).toBe(1.5);
    expect(RULEBOOK.rescue).toBe(20);
    expect(RULEBOOK.questionAnswered).toBe(2);
    expect([RULEBOOK.featureMerged, RULEBOOK.featureReviewed]).toEqual([30, 10]);
    expect(RULEBOOK.trancheMinutes).toBe(240);
    expect(RULEBOOK.distressAfterWorkingMinutes).toBe(480);
    expect(RULEBOOK.lostAfterWorkingMinutes).toBe(10 * 9 * 60);
    expect(RULEBOOK.aftershockWindowDays).toBe(14);
  });
});

describe('rulebook xp block', () => {
  const { xp } = RULEBOOK;

  it('holds the weights, the curve, the cap and the unlocks the game room spec sets out, frozen', () => {
    expect(xp).toEqual({
      weights: { zoneSecured: 1, woundClosed: 1, rescue: 1, expedition: 1, closer: 1, questionAnswered: 1, featureMerged: 1, featureReviewed: 1 },
      curve: { first: 1, step: 25 },
      cap: 99,
      unlocks: { invaders: 1, platformer: 2 },
    });
    for (const part of [xp, xp.weights, xp.curve, xp.unlocks]) expect(Object.isFrozen(part)).toBe(true);
  });

  it('climbs a curve that strictly increases from the first point up to the cap', () => {
    expect(xpForLevel(1, xp)).toBeGreaterThan(0);
    for (let level = 2; level <= xp.cap; level++) {
      expect(xpForLevel(level, xp), `LV ${level}`).toBeGreaterThan(xpForLevel(level - 1, xp));
    }
  });

  it('unlocks every game at a whole level between 1 and the cap', () => {
    expect(Object.keys(xp.unlocks).length).toBeGreaterThan(0);
    for (const [game, level] of Object.entries(xp.unlocks)) {
      expect(Number.isInteger(level), game).toBe(true);
      expect(level, game).toBeGreaterThanOrEqual(1);
      expect(level, game).toBeLessThanOrEqual(xp.cap);
    }
  });
});
