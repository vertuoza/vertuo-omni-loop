// The sync's read of the PRD dossiers' times (PRD 2370, s3), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every numbered PRD dossier with its plan versions, parsed with
// the schema the store parses it with.
import type { Boundary } from '../../data/parse-rows';
import { DossierTimesRow, dossierTimesRows } from './dossier-times.repository';

export const boundaries: Boundary[] = [
  { name: 'stages/sync: dossier times', read: (db) => dossierTimesRows(db), schema: DossierTimesRow, shape: 'rows' },
];
