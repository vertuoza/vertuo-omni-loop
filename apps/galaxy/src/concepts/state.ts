// A concept's state (PRD 1272, s4), read from its facts in fix_facts (../fixes/facts/store.ts): in review
// while its concept PR is open, in the inbox once that PR has merged, and state unknown when the pull
// request could not be read, or none open or merged was found on the concept's branch. The list's cards
// and the concept's page show it as a chip (./state-chip.tsx); the page links the concept PR it read.
import type { ConceptFacts } from '../dossier/github/fix';
import { UNREAD } from '../dossier/github/summary';
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

export type ConceptState = 'in-review' | 'in-inbox' | 'unknown';

export const CONCEPT_STATE_LABELS: Readonly<Record<ConceptState, string>> = {
  'in-review': 'in review',
  'in-inbox': 'in the inbox',
  unknown: 'state unknown',
};

/** The concept PR its facts name; null with no facts, a pull request not read, or none found. */
export function conceptPull(facts: ConceptFacts | null): { number: PrNumber; url: string } | null {
  const pull = facts?.pull;
  return pull && pull !== UNREAD ? { number: pull.number, url: pull.url } : null;
}

export function conceptState(facts: ConceptFacts | null): ConceptState {
  const pull = facts?.pull;
  if (!pull || pull === UNREAD) return 'unknown';
  return pull.state === 'open' ? 'in-review' : 'in-inbox';
}
