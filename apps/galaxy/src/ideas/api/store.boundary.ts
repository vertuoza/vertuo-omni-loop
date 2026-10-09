// The ideas API's read (PRD 1246, s2), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// the repository row `add` reads to find the caller's workspace, parsed with the schema the store parses
// it with. The board's own read, ideas_board(), is s1's (../store.boundary.ts).
import type { Boundary } from '../../data/parse-rows';
import { listingOf, ListingRow, WHERE_REPOSITORY } from './store';

export const boundaries: Boundary[] = [
  { name: WHERE_REPOSITORY, read: (db) => listingOf(db, 'vertuoza/vertuo-omni-loop'), schema: ListingRow, shape: 'rows' },
];
