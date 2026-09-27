import { describe, expect, it, vi } from 'vitest';
import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.mjs';
import type { FleetRow } from '../../arcade/types';

vi.mock('server-only', () => ({}));

// The fleets' trading cards (PRD 261, s5): one per built-in fleet that is not retired, each with a
// scoring value on its back that the rulebook holds.
const { cardsOf, RULES } = await import('./cards');
const { demoFleets } = await import('../../data/load-galaxy');

const fleet = (name: string, over: Partial<FleetRow> = {}): FleetRow => ({
  name, home: null, label: name.toUpperCase(), color: '#ffffff', motto: '', mascot: null, sort: 0, retired: false, ...over,
});

describe('the trading cards', () => {
  it('deals one card per built-in fleet that is not retired, in the fleets\' order', () => {
    const fleets = demoFleets();
    const live = fleets.filter((f) => !f.retired);
    expect(live.length).toBeLessThan(fleets.length);
    expect(cardsOf(fleets).map((c) => c.name)).toEqual(live.map((f) => f.name));
  });

  it('carries the fleet\'s label, motto, colour and mascot on the card', () => {
    const [card] = cardsOf([fleet('beaver', { label: 'BEAVER', motto: 'Builds the dam.', color: '#d08a4a', mascot: 'beaver' })]);
    expect(card).toMatchObject({ label: 'BEAVER', motto: 'Builds the dam.', color: '#d08a4a', mascot: 'beaver' });
  });

  it('gives each built-in fleet the rule the approved ad gives it, with the rulebook\'s number', () => {
    const rules = Object.fromEntries(cardsOf(demoFleets()).map((c) => [c.name, c.rule]));
    expect(rules).toEqual({
      beaver: `A secured zone scores ${RULEBOOK.zoneSecured}.`,
      octopod: `Closing unconfirmed ground scores ${RULEBOOK.woundClose['unconfirmed-ground']}.`,
      picsou: `Closing a fault line scores ${RULEBOOK.woundClose['fault-line']}.`,
      cia: `Closing a beacon scores ${RULEBOOK.woundClose.beacon}.`,
      pirates: `A rescue scores ${RULEBOOK.rescue}.`,
    });
  });

  it('states only numbers the rulebook holds, for a fleet it has no rule of its own for too', () => {
    const held = new Set([RULEBOOK.zoneSecured, RULEBOOK.rescue, ...Object.values(RULEBOOK.woundClose)].map(String));
    const cards = cardsOf(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => fleet(n)));
    for (const { rule } of cards) {
      const numbers = rule.match(/\d+/g) ?? [];
      expect(numbers, rule).toHaveLength(1);
      expect(held.has(numbers[0] ?? ''), rule).toBe(true);
    }
    for (const r of RULES) expect(r.text).toContain(String(r.value));
  });
});
