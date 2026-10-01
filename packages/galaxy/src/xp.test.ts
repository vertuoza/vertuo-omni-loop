// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { borrowedXp, experience, levelFor, unlockedFor, xpForLevel, XP_RULES } from './index.ts';
import { demoEvents } from './demo.ts';
import { RULEBOOK } from '../../../game/rulebook.ts';
import { makeEvent } from '../../../game/events.ts';

const NOW = new Date('2026-09-23T14:00:00Z');
const secured = (login, zone, at = '2026-09-21T10:00:00Z') => makeEvent({
  id: `zone:core-repo:7:${zone}:secured`, at, type: 'ZONE_SECURED', planet: 7, region: 'core-repo', contributor: login, team: 'beaver', data: {},
});

describe('the XP the arcade reads', () => {
  it('re-exports the rules and the functions of game/experience.ts, so they are applied in one place', () => {
    expect(XP_RULES).toBe(RULEBOOK.xp);
    expect(levelFor(150)).toBe(3);
    expect(xpForLevel(4)).toBe(300);
    expect(unlockedFor(1, [])).toEqual(['invaders']);
    expect(experience([secured('Alice', 's1')], { now: NOW })).toEqual({ alice: 10 });
  });
});

describe('borrowedXp', () => {
  it('borrows the XP of the highest-XP contributor, with its level and unlocked games', () => {
    const events = [secured('alice', 's1'), secured('bob', 's2'), secured('bob', 's3'), secured('bob', 's4')];
    expect(borrowedXp(events, { now: NOW })).toEqual({ login: 'bob', xp: 30, level: 1, unlocked: ['invaders'] });
  });

  it('takes the first login in order on a tie', () => {
    expect(borrowedXp([secured('zed', 's1'), secured('amy', 's2')], { now: NOW })?.login).toBe('amy');
  });

  it('borrows nothing from a world where nobody earned XP', () => {
    expect(borrowedXp([], { now: NOW })).toBeNull();
    const claimed = makeEvent({ id: 'zone:core-repo:7:s1:claimed', at: '2026-09-21T09:00:00Z', type: 'ZONE_CLAIMED', planet: 7, region: 'core-repo', contributor: 'alice', team: 'beaver', data: {} });
    expect(borrowedXp([claimed], { now: NOW })).toBeNull();
  });

  it('reads the rules it is given', () => {
    const rules = { ...RULEBOOK.xp, weights: { ...RULEBOOK.xp.weights, zoneSecured: 6 } };
    expect(borrowedXp([secured('alice', 's1')], { now: NOW, rules })).toEqual({ login: 'alice', xp: 60, level: 2, unlocked: ['invaders', 'platformer'] });
  });

  it('gives the demo guest a level and the first game, so the demo shows the game room lit', () => {
    const guest = borrowedXp(demoEvents(NOW), { now: NOW });
    expect(guest).not.toBeNull();
    expect(guest.level).toBeGreaterThanOrEqual(1);
    expect(guest.unlocked).toContain('invaders');
    const everyone = Object.values(experience(demoEvents(NOW), { now: NOW }));
    expect(guest.xp).toBe(Math.max(...everyone));
  });
});
