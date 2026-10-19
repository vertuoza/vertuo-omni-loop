// The touch's read of the GitHub snapshots (PRD 902, s3), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every dossier's snapshot, parsed with the schema the store
// parses it with.
import type { Boundary } from '../data/parse-rows';
import { CONCEPT_COLUMNS, ConceptRow, TOUCHED_COLUMNS, TouchedRow } from './store';

export const boundaries: Boundary[] = [
  { name: 'touched/store: dossier_github', read: (db) => db.from('dossier_github').select(TOUCHED_COLUMNS), schema: TouchedRow, shape: 'rows' },
  { name: 'touched/store: dossiers', read: (db) => db.from('dossiers').select(CONCEPT_COLUMNS).eq('kind', 'concept'), schema: ConceptRow, shape: 'rows' },
];
