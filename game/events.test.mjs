import { describe, it, expect } from 'vitest';
import { EVENT_TYPES, WOUND_KINDS, eventId, makeEvent } from './events.mjs';

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
