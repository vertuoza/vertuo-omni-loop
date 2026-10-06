// The constituents' reads (PRD 1030), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// the panel's two selects, and the whole row the constituent functions answer (read here with a plain
// select of every column, as the script only reads), each parsed with the module's schema.
import type { Boundary } from '../data/parse-rows';
import { CONSTITUENT_COLUMNS, EVENT_COLUMNS, SavedConstituentRow, StoredConstituent, StoredConstituentEvent } from './model';

export const boundaries: Boundary[] = [
  { name: 'constituents/load: constituents', read: (db) => db.from('constituents').select(CONSTITUENT_COLUMNS), schema: StoredConstituent, shape: 'rows' },
  { name: 'constituents/load: constituent_events', read: (db) => db.from('constituent_events').select(EVENT_COLUMNS), schema: StoredConstituentEvent, shape: 'rows' },
  { name: 'constituents/store: the row a function answers', read: (db) => db.from('constituents').select('*'), schema: SavedConstituentRow, shape: 'rows' },
];
