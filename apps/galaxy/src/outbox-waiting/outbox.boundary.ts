import type { Boundary } from '../data/parse-rows';
import { DOSSIER_COLUMNS, MAX_DOSSIERS, WaitingDossierRow } from './outbox';

// GET /api/waiting/outbox's own read (PRD 1030), for `pnpm schemas:verify`: the newest numbered
// dossiers, whoever opened them.
export const boundaries: Boundary[] = [
  {
    name: 'outbox-waiting: dossiers',
    read: (db) => db.from('dossiers').select(DOSSIER_COLUMNS).not('prd', 'is', null).order('created_at', { ascending: false }).limit(MAX_DOSSIERS),
    schema: WaitingDossierRow,
    shape: 'rows',
  },
];
