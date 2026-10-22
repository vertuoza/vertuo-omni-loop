// The stored waits' reads (PRD 2377, s1), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// each select of ./waits.repository.ts, over every workspace, parsed with the schema the repository
// parses it with.
import type { Boundary } from '../../data/parse-rows';
import { loginsOf, openWaitsOf, ownersOf, StoredLoginRow, StoredOwnerRow, StoredWaitRow } from './waits.repository';

const WHERE = 'stages/sync/waits.repository';

export const boundaries: Boundary[] = [
  { name: `${WHERE}: waits`, read: (db) => openWaitsOf(db), schema: StoredWaitRow, shape: 'rows' },
  { name: `${WHERE}: dossiers`, read: (db) => ownersOf(db), schema: StoredOwnerRow, shape: 'rows' },
  { name: `${WHERE}: players`, read: (db) => loginsOf(db), schema: StoredLoginRow, shape: 'rows' },
];
