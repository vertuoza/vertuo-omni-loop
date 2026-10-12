// The sync's read of the PRDs born on the server (PRD 1299, s6), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every ◆ PRD dossier with its approvals, parsed with the schema
// the store parses it with.
import type { Boundary } from '../../data/parse-rows';
import { SERVER_BORN_COLUMNS, ServerBornRow } from './approvals';

export const boundaries: Boundary[] = [
  { name: 'stages/sync: dossiers born on the server', read: (db) => db.from('dossiers').select(SERVER_BORN_COLUMNS).eq('birthplace', 'server').not('prd', 'is', null), schema: ServerBornRow, shape: 'rows' },
];
