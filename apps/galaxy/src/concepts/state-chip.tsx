import { CONCEPT_STATE_LABELS, type ConceptState } from './state';

// A concept's state as a chip (PRD 1272, s4), drawn as a fix's state pill is (dossier.css › .fix-state):
// in review edged in cyan, in the inbox filled as a merged fix is, state unknown muted.

const CLASS: Readonly<Record<ConceptState, string>> = {
  'in-review': 'fix-state-in-review',
  'in-inbox': 'fix-state-merged',
  unknown: 'fix-state-unknown',
};

export function ConceptStateChip({ state }: { state: ConceptState }) {
  return <span className={`fix-state ${CLASS[state]}`}>{CONCEPT_STATE_LABELS[state]}</span>;
}
