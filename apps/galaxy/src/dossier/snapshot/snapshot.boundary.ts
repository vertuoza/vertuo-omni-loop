// The GitHub snapshot store's read (PRD 902, s2), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every dossier's snapshot, parsed with the schema the store
// parses it with.
import type { Boundary } from '../../data/parse-rows';
import { SNAPSHOT_COLUMNS, StoredSnapshotRow } from './store';

export const boundaries: Boundary[] = [
  { name: 'dossier/snapshot: dossier_github', read: (db) => db.from('dossier_github').select(SNAPSHOT_COLUMNS), schema: StoredSnapshotRow, shape: 'rows' },
];
