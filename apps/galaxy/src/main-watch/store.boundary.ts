// The main watch store's reads (PRD 2410, s3), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// each of its selects, every PRD's rows, parsed with the schema the store parses them with.
import type { Boundary } from '../data/parse-rows';
import { breakRows, StoredBreak, StoredWatch, watchRows } from './store.repository';

export const boundaries: Boundary[] = [
  { name: 'main-watch/store: prd_main_watch', read: (db) => watchRows(db), schema: StoredWatch, shape: 'rows' },
  { name: 'main-watch/store: prd_main_breaks', read: (db) => breakRows(db), schema: StoredBreak, shape: 'rows' },
];
