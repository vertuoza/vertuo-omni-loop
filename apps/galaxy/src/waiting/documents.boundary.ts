import type { Boundary } from '../data/parse-rows';
import { DocumentRead, newestVersions } from './waiting.repository';

// The New documents part's own read (PRD 1030), for `pnpm schemas:verify`: the newest versions of the
// numbered dossiers, whoever opened them, at any date, as the waiting repository reads them.
export const boundaries: Boundary[] = [
  {
    name: 'waiting/documents: dossier_versions',
    read: (db) => newestVersions(db),
    schema: DocumentRead,
    shape: 'rows',
  },
];
