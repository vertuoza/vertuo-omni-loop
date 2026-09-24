import { describe, it, expect } from 'vitest';
import { RULEBOOK } from './rulebook.mjs';

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
    expect(RULEBOOK.trancheMinutes).toBe(240);
    expect(RULEBOOK.distressAfterWorkingMinutes).toBe(480);
    expect(RULEBOOK.lostAfterWorkingMinutes).toBe(10 * 9 * 60);
    expect(RULEBOOK.aftershockWindowDays).toBe(14);
  });
});
