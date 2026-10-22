// The sync's read of the PRD dossiers' times (PRD 2370, s3), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): its select, every numbered PRD dossier with its plan versions, parsed with
// the schema the store parses it with.
import type { Boundary } from '../../data/parse-rows';
import { DOSSIER_TIMES_COLUMNS, DossierTimesRow } from './dossier-times';

export const boundaries: Boundary[] = [
  { name: 'stages/sync: dossier times', read: (db) => db.from('dossiers').select(DOSSIER_TIMES_COLUMNS).eq('kind', 'prd').not('prd', 'is', null).eq('dossier_versions.kind', 'plan'), schema: DossierTimesRow, shape: 'rows' },
];
