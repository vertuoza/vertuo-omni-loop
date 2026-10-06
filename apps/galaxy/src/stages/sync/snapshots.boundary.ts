// The sync's snapshot store's read (PRD 902, s4), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every stale snapshot with its dossier, parsed with the schema
// the store parses it with.
import type { Boundary } from '../../data/parse-rows';
import { STALE_COLUMNS, StaleSnapshotRow } from './snapshots';

export const boundaries: Boundary[] = [
  { name: 'stages/sync: dossier_github', read: (db) => db.from('dossier_github').select(STALE_COLUMNS).not('stale_since', 'is', null), schema: StaleSnapshotRow, shape: 'rows' },
];
