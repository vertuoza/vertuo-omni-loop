import type { Boundary } from '../data/parse-rows';
import { DOCS_LIMIT, DOCUMENT_COLUMNS, DocumentRead } from './documents';

// The New documents part's own read (PRD 1030), for `pnpm schemas:verify`: the newest versions of the
// numbered dossiers, whoever opened them, at any date.
export const boundaries: Boundary[] = [
  {
    name: 'waiting/documents: dossier_versions',
    read: (db) => db.from('dossier_versions').select(DOCUMENT_COLUMNS).not('dossier.prd', 'is', null).order('created_at', { ascending: false }).limit(DOCS_LIMIT),
    schema: DocumentRead,
    shape: 'rows',
  },
];
