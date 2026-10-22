// The stored waits' reads (PRD 2377, s1), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// each select of ./waits.repository.ts, over every workspace, parsed with the schema the repository
// parses it with.
import type { Boundary } from '../../data/parse-rows';
import {
  approversOf, itemsOf, loginsOf, openWaitsOf, ownersOf, productsOf, reachedOf,
  StoredApproverRow, StoredItemsRow, StoredLoginRow, StoredOwnerRow, StoredProductRow, StoredReachedRow, StoredWaitRow,
} from './waits.repository';

const WHERE = 'stages/sync/waits.repository';

export const boundaries: Boundary[] = [
  { name: `${WHERE}: waits`, read: (db) => openWaitsOf(db), schema: StoredWaitRow, shape: 'rows' },
  { name: `${WHERE}: dossiers`, read: (db) => ownersOf(db), schema: StoredOwnerRow, shape: 'rows' },
  { name: `${WHERE}: players`, read: (db) => loginsOf(db), schema: StoredLoginRow, shape: 'rows' },
  { name: `${WHERE}: products`, read: (db) => productsOf(db), schema: StoredProductRow, shape: 'rows' },
  { name: `${WHERE}: approvers`, read: (db) => approversOf(db), schema: StoredApproverRow, shape: 'rows' },
  { name: `${WHERE}: outboxes`, read: (db) => itemsOf(db), schema: StoredItemsRow, shape: 'rows' },
  { name: `${WHERE}: stages`, read: (db) => reachedOf(db), schema: StoredReachedRow, shape: 'rows' },
];
