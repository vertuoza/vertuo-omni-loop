import { pushDossier } from '../../../../src/dossier/api';
import { dossierDeps } from '../../../../src/dossier/api-live';

// POST /api/dossiers/push {repo, prd, title, draftId?, artifacts} → {id, url, added, unchanged}: a PRD
// folder's artifacts, a version added where one changed (src/dossier/api.ts).
export const maxDuration = 60;

export function POST(request: Request) {
  return pushDossier(request, dossierDeps());
}
