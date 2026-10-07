// The touch's read of the GitHub snapshots (PRD 902, s3), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every dossier's snapshot, parsed with the schema the store
// parses it with.
import type { Boundary } from '../data/parse-rows';
import { TOUCHED_COLUMNS, TouchedRow } from './store';

export const boundaries: Boundary[] = [
  { name: 'touched/store: dossier_github', read: (db) => db.from('dossier_github').select(TOUCHED_COLUMNS), schema: TouchedRow, shape: 'rows' },
];
