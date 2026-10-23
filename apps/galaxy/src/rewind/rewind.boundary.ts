// The rewind's reads (PRD 2410, s5), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts): each
// of its selects, every row, parsed with the schema the repository parses them with.
import type { Boundary } from '../data/parse-rows';
import {
  decidableRows, deciderRows, findingRows, StoredDecidable, StoredDecider, StoredFinding, StoredWatchWorkspace, watchWorkspaceRows,
} from './rewind.repository';

export const boundaries: Boundary[] = [
  { name: 'rewind/repository: rewind_findings', read: (db) => findingRows(db), schema: StoredFinding, shape: 'rows' },
  { name: 'rewind/repository: rewind_findings to decide', read: (db) => decidableRows(db), schema: StoredDecidable, shape: 'rows' },
  { name: 'rewind/repository: players', read: (db) => deciderRows(db), schema: StoredDecider, shape: 'rows' },
  { name: 'rewind/repository: prd_main_watch', read: (db) => watchWorkspaceRows(db), schema: StoredWatchWorkspace, shape: 'rows' },
];
