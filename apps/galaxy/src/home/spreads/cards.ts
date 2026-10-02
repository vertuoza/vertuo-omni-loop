import { RULEBOOK } from 'vertuo-omni-plan/game/rulebook.ts';
import type { FleetRow } from '../../arcade/types';

// COLLECT ALL THE FLEETS! (PRD 261): fleets as trading cards (HOME deals its own example fleets,
// PRD 971). The front is the fleet's mascot, label and motto; the back its colour and one scoring
// value, read from the game's rulebook so a card never states a number the rulebook does not hold.

/** A scoring value a card's back may state: the rulebook's number, and the sentence that says it. */
export interface CardRule { key: string; value: number; text: string }

const rule = (key: string, value: number, words: string): CardRule => ({ key, value, text: `${words} scores ${value}.` });

/** Every value a card may carry: a zone secured, a rescue, or an Entropy kind closed. */
export const RULES: readonly CardRule[] = [
  rule('zoneSecured', RULEBOOK.zoneSecured, 'A secured zone'),
  rule('woundClose.unconfirmed-ground', RULEBOOK.woundClose['unconfirmed-ground'], 'Closing unconfirmed ground'),
  rule('woundClose.fault-line', RULEBOOK.woundClose['fault-line'], 'Closing a fault line'),
  rule('woundClose.beacon', RULEBOOK.woundClose.beacon, 'Closing a beacon'),
  rule('rescue', RULEBOOK.rescue, 'A rescue'),
];

/** The value a card carries by its fleet's mascot (PRD 400: keyed by mascot, never by name), as the approved ad deals them. */
export const RULE_BY_MASCOT: Readonly<Record<string, string>> = {
  beaver: 'zoneSecured',
  octopod: 'woundClose.unconfirmed-ground',
  picsou: 'woundClose.fault-line',
  cia: 'woundClose.beacon',
  pirate: 'rescue',
};

export interface Card {
  name: string;
  label: string;
  motto: string;
  color: string;
  mascot: string | null;
  rule: string;
}

/** One card per fleet that is not retired, in the fleets' order. A fleet whose mascot has no value takes the next in turn. */
export function cardsOf(fleets: readonly FleetRow[]): Card[] {
  return fleets
    .filter((f) => !f.retired)
    .map((f, i) => {
      const own = f.mascot && Object.hasOwn(RULE_BY_MASCOT, f.mascot) ? RULES.find((r) => r.key === RULE_BY_MASCOT[f.mascot!]) : undefined;
      return { name: f.name, label: f.label, motto: f.motto, color: f.color, mascot: f.mascot, rule: (own ?? RULES[i % RULES.length]!).text };
    });
}
