import { findDossier, openDossier } from '../../../src/dossier/api';
import { dossierDeps } from '../../../src/dossier/api-live';

// POST /api/dossiers {title, repo, claudeSessionId?} → 201 {id, url}: opens a draft dossier (src/dossier/api.ts).
// GET /api/dossiers?repo=<owner/name>&prd=<n> → 200 {id, url}: finds PRD n's dossier (PRD 413).
export const maxDuration = 60;

export function POST(request: Request) {
  return openDossier(request, dossierDeps());
}

export function GET(request: Request) {
  return findDossier(request, dossierDeps());
}
