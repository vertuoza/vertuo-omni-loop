import { describe, expect, it } from 'vitest';
import { MASCOTS, spritePixels } from '@omni/design';
import { RULE_BY_MASCOT } from './cards';
import { sure } from '../../arcade/sure';
import { EXAMPLE_FLEETS } from './fleets';

// HOME's own example fleets (PRD 971, s4): invented for the page, none of them the demo galaxy's,
// and every one flies a mascot.
describe('the example fleets', () => {
  it('are DAM BUSTERS, DEEP DIVERS, GOLD DIGGERS, SPY RING and SEA DOGS, with their mascots', () => {
    expect(EXAMPLE_FLEETS.map((f) => [f.label, f.mascot])).toEqual([
      ['DAM BUSTERS', 'beaver'],
      ['DEEP DIVERS', 'octopod'],
      ['GOLD DIGGERS', 'picsou'],
      ['SPY RING', 'cia'],
      ['SEA DOGS', 'pirate'],
    ]);
  });

  it('each fly a mascot the sprite library holds and the cards map to a rule', () => {
    for (const f of EXAMPLE_FLEETS) {
      expect(MASCOTS, f.label).toContain(f.mascot);
      expect(() => spritePixels(sure(f.mascot, `${f.label}'s mascot`)), f.label).not.toThrow();
      expect(Object.hasOwn(RULE_BY_MASCOT, sure(f.mascot, `${f.label}'s mascot`)), f.label).toBe(true);
    }
  });

  it('each carry their own colour, a motto and example points, and none is retired', () => {
    for (const f of EXAMPLE_FLEETS) {
      expect(f.color, f.label).toMatch(/^#[0-9a-f]{6}$/);
      expect(f.motto.length, f.label).toBeGreaterThan(0);
      expect(Number.isInteger(f.points) && f.points > 0, f.label).toBe(true);
      expect(f.retired, f.label).toBe(false);
    }
    expect(new Set(EXAMPLE_FLEETS.map((f) => f.color)).size).toBe(EXAMPLE_FLEETS.length);
    expect(new Set(EXAMPLE_FLEETS.map((f) => f.points)).size).toBe(EXAMPLE_FLEETS.length);
  });

  it('name none of the demo galaxy\'s fleets', () => {
    for (const f of EXAMPLE_FLEETS) {
      expect(['BUILDERS', 'INKLINGS', 'COINERS', 'NIGHT OWLS', 'CORSAIRS', 'CAPES']).not.toContain(f.label);
    }
  });
});
