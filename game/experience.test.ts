import { describe, it, expect } from 'vitest';
import { experience, levelFor, unlockedFor, xpForLevel, xpKindOf, playerXp, counted, type XpRules } from './experience.ts';
import { score } from './economy.ts';
import { EVENT_TYPES, type EventType, type GameEvent } from './events.ts';
import { RULEBOOK } from './rulebook.ts';

const NOW = new Date('2026-09-30T16:00:00Z');
// Every event names its home (PRD 728): a row with none was written before the fresh start.
const E = (id: string, at: string, type: EventType, over: Partial<GameEvent> = {}): GameEvent => ({ id, at, type, planet: 2332, home: 'acme/plan', data: {}, ...over });
const old = (event: GameEvent): GameEvent => {
  const e = { ...event };
  delete e.home;
  return e;
};
const charted = E('planet:2332:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { data: { ownerTeam: 'beaver', captain: 'pm' } });
const secured = (id: string, at: string, contributor: string, team = 'octopod', planet = 2332) => E(`zone:r:${planet}:${id}:secured`, at, 'ZONE_SECURED', { planet, contributor, team });
const closed = (id: string, at: string, contributor: string, team: string, kind: string) => [
  E(`${id}:opened`, '2026-09-21T09:00:00Z', 'WOUND_OPENED', { data: { kind, rank: 'high' } }),
  E(`${id}:closed`, at, 'WOUND_CLOSED', { contributor, team, data: { kind, rank: 'high', verdict: 'agreed' } }),
];
const rules = (over: Partial<XpRules> = {}): XpRules => ({ ...RULEBOOK.xp, ...over, weights: { ...RULEBOOK.xp.weights, ...(over.weights ?? {}) } });

describe('experience', () => {
  it('gives 10 XP for one zone secured in working hours, and 15 at night', () => {
    expect(experience([
      charted,
      secured('s1', '2026-09-21T12:00:00Z', 'alice'), // Monday 14:00 in Brussels
      secured('s2', '2026-09-21T20:00:00Z', 'bob'),   // Monday 22:00 in Brussels
    ], { now: NOW })).toEqual({ alice: 10, bob: 15 });
  });

  it('counts the cross-fleet multiplier of a wound close, rounding once after summing', () => {
    // Each close pays 15 × 1.5 = 22.5; rounded once, two of them are 45, not 2 × 23.
    expect(experience([
      charted,
      ...closed('w1', '2026-09-21T11:00:00Z', 'eve', 'octopod', 'unconfirmed-ground'),
      ...closed('w2', '2026-09-22T11:00:00Z', 'eve', 'octopod', 'unconfirmed-ground'),
      ...closed('w3', '2026-09-23T11:00:00Z', 'pm', 'beaver', 'beacon'),
    ], { now: NOW })).toEqual({ eve: 45, pm: 25 });
  });

  it('multiplies each kind by its weight, and leaves out a kind weighted 0', () => {
    const events = [
      charted,
      secured('s1', '2026-09-21T12:00:00Z', 'alice'),
      E('planet:2332:rescue:a', '2026-09-22T12:00:00Z', 'RESCUE', { contributor: 'alice', team: 'cia' }),
    ];
    expect(experience(events, { now: NOW })).toEqual({ alice: 30 });
    expect(experience(events, { now: NOW, rules: rules({ weights: { zoneSecured: 2, rescue: 0 } }) })).toEqual({ alice: 20 });
    expect(experience(events, { now: NOW, rules: rules({ weights: { zoneSecured: 0.25 } }) })).toEqual({ alice: 23 }); // 2.5 + 20 = 22.5 → 23
  });

  it('adds up every season in the ledger', () => {
    expect(experience([
      charted,
      secured('s1', '2026-07-14T12:00:00Z', 'alice'),
      secured('s2', '2026-08-18T12:00:00Z', 'alice'),
      secured('s3', '2026-09-21T12:00:00Z', 'alice'),
    ], { now: NOW })).toEqual({ alice: 30 });
  });

  it('never lowers XP for a revert or a clawback', () => {
    const lostPlanet = E('planet:7:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { planet: 7, data: { ownerTeam: 'beaver' } });
    const events = [
      charted,
      secured('s1', '2026-09-21T12:00:00Z', 'alice'),
      E('zone:r:2332:s1:reverted', '2026-09-22T12:00:00Z', 'ZONE_REVERTED', { contributor: 'alice', team: 'octopod' }),
      lostPlanet,
      secured('s9', '2026-09-21T12:00:00Z', 'bob', 'octopod', 7),
      E('planet:7:lost', '2026-09-25T12:00:00Z', 'PLANET_LOST', { planet: 7, data: { ownerTeam: 'beaver', reason: 'closed' } }),
    ];
    // The season's points take both back…
    expect(score(events, { season: '2026-09', now: NOW }).individuals).toEqual({ alice: 0, bob: 0 });
    // …XP keeps them.
    expect(experience(events, { now: NOW })).toEqual({ alice: 10, bob: 10 });
  });

  it('gives no XP for a fleet credit: a terraform or a decay', () => {
    const events = [
      charted,
      E('w1:opened', '2026-09-21T07:00:00Z', 'WOUND_OPENED', { data: { kind: 'beacon', rank: 'human-action' } }), // decays the owner fleet
      E('planet:2332:terraformed', '2026-09-22T12:00:00Z', 'PLANET_TERRAFORMED', { data: { ownerTeam: 'beaver', class: 1, crossSector: false } }),
    ];
    const reasons = score(events, { season: '2026-09', now: NOW }).credits.map((c) => c.reason);
    expect(reasons).toEqual(expect.arrayContaining(['planet terraformed', 'decay: beacon']));
    expect(experience(events, { now: NOW })).toEqual({});
  });

  it('keeps a row, at 0 XP, for every login the ledger names, and lower-cases every login', () => {
    expect(experience([
      charted,
      E('zone:r:2332:s1:claimed', '2026-09-20T12:00:00Z', 'ZONE_CLAIMED', { contributor: 'Claimer', team: 'octopod' }),
      secured('s1', '2026-09-21T12:00:00Z', 'Alice'),
      secured('s2', '2026-09-22T12:00:00Z', 'alice'),
    ], { now: NOW })).toEqual({ alice: 20, claimer: 0 });
  });

  it('lists the logins it is also given, at 0 unless the events pay them (PRD 728)', () => {
    expect(experience([charted, secured('s1', '2026-09-21T12:00:00Z', 'bob')], { now: NOW, logins: ['Alice', 'bob'] })).toEqual({ alice: 0, bob: 10 });
  });

  it('reads only the xp block it is given, and the rulebook\'s by default', () => {
    const events = [charted, secured('s1', '2026-09-21T12:00:00Z', 'alice')];
    expect(experience(events, { now: NOW })).toEqual(experience(events, { now: NOW, rules: RULEBOOK.xp }));
  });
});

describe('xpKindOf', () => {
  it('names the weight of every positive personal credit', () => {
    expect(xpKindOf('zone secured')).toBe('zoneSecured');
    expect(xpKindOf('wound closed: beacon')).toBe('woundClosed');
    expect(xpKindOf('wound closed: under-fire')).toBe('woundClosed');
    expect(xpKindOf('rescue')).toBe('rescue');
    expect(xpKindOf('expedition bonus')).toBe('expedition');
    expect(xpKindOf('closer bonus')).toBe('closer');
  });

  it('names none for a debit, a fleet credit or a credit it does not know, so none of them counts', () => {
    for (const reason of ['zone reverted', 'planet terraformed', 'decay: beacon', 'mystery bonus']) expect(xpKindOf(reason), reason).toBeNull();
  });

  it('maps every personal credit score() emits to a weight key of the xp block', () => {
    // One ledger with every event type, so a new type (and the credit it may pay) fails here first.
    const lostPlanet = 7;
    const events = [
      charted,
      E('region:2332:vertuo-core:surveyed', '2026-09-02T08:00:00Z', 'REGION_SURVEYED', { region: 'vertuo-core' }),
      E('planet:2332:locked', '2026-09-03T08:00:00Z', 'PLANET_LOCKED'),
      E('planet:2332:unlocked', '2026-09-04T08:00:00Z', 'PLANET_UNLOCKED'),
      E('zone:r:2332:s1:opened', '2026-09-20T08:00:00Z', 'ZONE_OPENED'),
      E('zone:r:2332:s1:claimed', '2026-09-20T09:00:00Z', 'ZONE_CLAIMED', { contributor: 'alice', team: 'octopod' }),
      secured('s1', '2026-09-21T12:00:00Z', 'alice'),
      secured('s2', '2026-09-21T13:00:00Z', 'alice'),
      E('zone:r:2332:s2:reverted', '2026-09-21T14:00:00Z', 'ZONE_REVERTED', { contributor: 'alice', team: 'octopod' }),
      ...closed('w1', '2026-09-21T15:00:00Z', 'eve', 'octopod', 'beacon'),
      E('planet:2332:distress', '2026-09-22T08:00:00Z', 'DISTRESS'),
      E('planet:2332:rescue:a', '2026-09-22T12:00:00Z', 'RESCUE', { contributor: 'bob', team: 'cia' }),
      E('planet:2332:ready', '2026-09-22T13:00:00Z', 'PLANET_READY'),
      E('planet:2332:terraformed', '2026-09-22T14:00:00Z', 'PLANET_TERRAFORMED', { data: { ownerTeam: 'beaver', class: 1, crossSector: false } }),
      E('planet:7:charted', '2026-09-01T08:00:00Z', 'PLANET_CHARTED', { planet: lostPlanet, data: { ownerTeam: 'beaver' } }),
      secured('s9', '2026-09-21T12:00:00Z', 'dan', 'picsou', lostPlanet),
      E('planet:7:lost', '2026-09-25T12:00:00Z', 'PLANET_LOST', { planet: lostPlanet, data: { ownerTeam: 'beaver', reason: 'closed' } }),
      E('planet:7:decommissioned', '2026-09-26T12:00:00Z', 'PLANET_DECOMMISSIONED', { planet: lostPlanet }),
    ];
    expect(new Set(events.map((e) => e.type))).toEqual(new Set(EVENT_TYPES));

    const personal = score(events, { season: '2026-09', now: NOW }).credits.filter((c) => c.to && c.points > 0);
    const kinds = new Set();
    for (const { reason } of personal) {
      const kind = xpKindOf(reason);
      expect(Object.keys(RULEBOOK.xp.weights), `"${reason}" has no weight in RULEBOOK.xp.weights`).toContain(kind);
      kinds.add(kind);
    }
    expect(kinds).toEqual(new Set(Object.keys(RULEBOOK.xp.weights))); // the ledger above pays every kind
  });
});

describe('levelFor', () => {
  it('gives no level at 0 XP, LV 1 at the first point, then LV n at 25·n·(n−1)', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(1)).toBe(1);
    expect(levelFor(49)).toBe(1);
    expect(levelFor(50)).toBe(2);
    expect(levelFor(149)).toBe(2);
    expect(levelFor(150)).toBe(3);
    expect(levelFor(500)).toBe(5);
    expect(levelFor(2249)).toBe(9);
    expect(levelFor(2250)).toBe(10);
  });

  it('stops at the cap', () => {
    expect(levelFor(xpForLevel(99))).toBe(99);
    expect(levelFor(10_000_000)).toBe(99);
    expect(levelFor(10_000, rules({ cap: 5 }))).toBe(5);
  });

  it('follows the curve it is given', () => {
    const steep = rules({ curve: { first: 10, step: 100 } });
    expect(levelFor(9, steep)).toBe(0);
    expect(levelFor(10, steep)).toBe(1);
    expect(levelFor(200, steep)).toBe(2);
  });
});

describe('xpForLevel', () => {
  it('is the first point for LV 1 and step·n·(n−1) after', () => {
    expect([1, 2, 3, 5, 10].map((n) => xpForLevel(n))).toEqual([1, 50, 150, 500, 2250]);
  });
});

describe('unlockedFor', () => {
  it('unlocks every game whose level the player reaches, and none before the first point', () => {
    expect(unlockedFor(0, [])).toEqual([]);
    expect(unlockedFor(1, [])).toEqual(['invaders']);
    const more = rules({ unlocks: { invaders: 1, maze: 5 } });
    expect(unlockedFor(4, [], more)).toEqual(['invaders']);
    expect(unlockedFor(5, [], more)).toEqual(['invaders', 'maze']);
  });

  it('opens Super Omni World at LV 2 under the rulebook, and keeps it after a rule change moves it later (PRD 817)', () => {
    expect(unlockedFor(1, [])).toEqual(['invaders']);
    expect(unlockedFor(2, [])).toEqual(['invaders', 'platformer']);
    const later = rules({ unlocks: { invaders: 1, platformer: 9 } });
    expect(unlockedFor(2, ['invaders', 'platformer'], later)).toEqual(['invaders', 'platformer']);
  });

  it('adds to the games already stored, and never takes one away', () => {
    const later = rules({ unlocks: { invaders: 5 } });
    expect(unlockedFor(3, ['invaders'], later)).toEqual(['invaders']);
    expect(unlockedFor(0, ['invaders'], later)).toEqual(['invaders']);
    expect(unlockedFor(3, [], later)).toEqual([]);
    expect(unlockedFor(1, ['retired-game'])).toEqual(['invaders', 'retired-game']);
    expect(unlockedFor(1, ['invaders', 'invaders'])).toEqual(['invaders']);
  });
});

describe('playerXp', () => {
  it('gives every login its XP, level and unlocked games, in login order', () => {
    expect(playerXp([
      charted,
      secured('s1', '2026-09-21T12:00:00Z', 'Zed'),
      ...Array.from({ length: 5 }, (_, i) => secured(`a${i}`, `2026-09-2${i + 1}T12:00:00Z`, 'alice')),
      E('zone:r:2332:c:claimed', '2026-09-20T12:00:00Z', 'ZONE_CLAIMED', { contributor: 'claimer', team: 'octopod' }),
    ], { now: NOW })).toEqual([
      { login: 'alice', xp: 50, level: 2, unlocked: ['invaders', 'platformer'] },
      { login: 'claimer', xp: 0, level: 0, unlocked: [] },
      { login: 'zed', xp: 10, level: 1, unlocked: ['invaders'] },
    ]);
  });

  it('keeps a game already unlocked for a login the fresh start drops to 0 XP (PRD 728)', () => {
    expect(playerXp(counted([old(charted), old(secured('s1', '2026-09-21T12:00:00Z', 'alice'))]), { now: NOW, stored: { alice: ['invaders'] }, logins: ['alice'] })).toEqual([
      { login: 'alice', xp: 0, level: 0, unlocked: ['invaders'] },
    ]);
  });

  it('keeps the games stored for a login, whatever the new rules give', () => {
    const events = [charted, secured('s1', '2026-09-21T12:00:00Z', 'alice')];
    const nothingCounts = rules({ weights: { zoneSecured: 0 } });
    expect(playerXp(events, { now: NOW, rules: nothingCounts, stored: { alice: ['invaders'] } })).toEqual([
      { login: 'alice', xp: 0, level: 0, unlocked: ['invaders'] },
    ]);
  });
});

describe('counted', () => {
  it('keeps only the rows with a home: a row written before the fresh start counts for nothing (PRD 728)', () => {
    const now = secured('s1', '2026-09-21T12:00:00Z', 'alice');
    expect(counted([old(charted), now, old(now)])).toEqual([now]);
  });
});
