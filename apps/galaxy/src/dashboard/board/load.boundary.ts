// The board's contribution reads (PRD 1030), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its selects, every workspace's rows, parsed with the schemas the board
// parses them with.
import type { Boundary } from '../../data/parse-rows';
import { ACTIVITY_COLUMNS, OPENER_COLUMNS, StoredActivity, StoredOpener } from './load';

export const boundaries: Boundary[] = [
  { name: 'dashboard/board: contributions', read: (db) => db.from('contributions').select(ACTIVITY_COLUMNS), schema: StoredActivity, shape: 'rows' },
  {
    name: 'dashboard/board: contributions (prd-opened)',
    read: (db) => db.from('contributions').select(OPENER_COLUMNS).eq('kind', 'prd-opened'),
    schema: StoredOpener,
    shape: 'rows',
  },
];
