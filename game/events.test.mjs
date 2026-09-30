import { describe, it, expect } from 'vitest';
import { EVENT_TYPES, WOUND_KINDS, eventId, makeEvent, planetKey, planetKeyOf } from './events.mjs';

describe('events', () => {
  it('builds a deterministic id', () => {
    expect(eventId('pr', 'vertuo-ai-domain#1042', 'merged')).toBe('pr:vertuo-ai-domain#1042:merged');
  });

  it('names every type and wound kind the spec lists', () => {
    expect(EVENT_TYPES).toEqual([
      'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
      'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
      'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
      'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
    ]);
    expect(WOUND_KINDS).toEqual(['transmission', 'unconfirmed-ground', 'beacon', 'fault-line', 'under-fire', 'aftershock']);
  });

  it('validates an event and defaults data', () => {
    const e = makeEvent({ id: 'planet:2332:charted', at: '2026-09-01T08:00:00Z', type: 'PLANET_CHARTED', planet: 2332 });
    expect(e.data).toEqual({});
  });

  it('refuses an unknown type', () => {
    expect(() => makeEvent({ id: 'x', at: '2026-09-01T08:00:00Z', type: 'NOPE', planet: 1 })).toThrow();
  });
});

describe('the home of a PRD (PRD 728)', () => {
  it('keeps an event\'s home and keys its planet by <home>#<n>', () => {
    const e = makeEvent({ id: 'planet:acme/plan#88:charted', at: '2026-09-01T08:00:00Z', type: 'PLANET_CHARTED', planet: 88, home: 'acme/plan' });
    expect(e.home).toBe('acme/plan');
    expect(planetKeyOf(e)).toBe('acme/plan#88');
    expect(planetKey('acme/other', 88)).not.toBe(planetKeyOf(e));
    expect(planetKey(undefined, 88)).toBe('88');
  });

  it('refuses a home that is not owner/name in lower case', () => {
    for (const home of ['plan', 'Acme/Plan', 'a/b/c']) {
      expect(() => makeEvent({ id: 'x', at: '2026-09-01T08:00:00Z', type: 'PLANET_CHARTED', planet: 1, home })).toThrow();
    }
  });
});
