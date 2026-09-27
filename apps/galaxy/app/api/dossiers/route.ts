import { openDossier } from '../../../src/dossier/api';
import { dossierDeps } from '../../../src/dossier/api-live';

// POST /api/dossiers {title, repo, claudeSessionId?} → 201 {id, url}: opens a draft dossier (src/dossier/api.ts).
export const maxDuration = 60;

export function POST(request: Request) {
  return openDossier(request, dossierDeps());
}
