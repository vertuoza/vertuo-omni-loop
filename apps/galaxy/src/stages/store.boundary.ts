// The stage store's read of a PRD's stages (PRD 1030), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every PRD's rows, parsed with the schema the store parses
// them with.
import type { Boundary } from '../data/parse-rows';
import { STAGE_COLUMNS, StoredStageRow } from './store';

export const boundaries: Boundary[] = [
  { name: 'stages/store: prd_stages', read: (db) => db.from('prd_stages').select(STAGE_COLUMNS), schema: StoredStageRow, shape: 'rows' },
];
