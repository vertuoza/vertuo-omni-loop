// The reads of Jev's store (./store.ts), for `pnpm schemas:verify` (PRD 1030): each select, run
// against a real database and parsed with the schema the store parses it with. set_jev_decision()
// is not here: it writes, and the check only reads.
import type { Boundary } from '../data/parse-rows';
import { CALL_COLUMNS, DECISION_COLUMNS, StoredCall, StoredDecision } from './store';

export const boundaries: Boundary[] = [
  { name: 'jev/store: jev_decisions', read: (db) => db.from('jev_decisions').select(DECISION_COLUMNS), schema: StoredDecision, shape: 'rows' },
  { name: 'jev/store: jev_calls', read: (db) => db.from('jev_calls').select(CALL_COLUMNS).limit(500), schema: StoredCall, shape: 'rows' },
];
