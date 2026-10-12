import { getDossier } from '../../../../src/dossier/api';
import { dossierDeps } from '../../../../src/dossier/api-live';

// GET /api/dossiers/get?product=<key>&prd=<n>&kind=<kind> → {id, prdId, url, kind, version, sha256, content,
// createdAt}: a product PRD's latest version of one kind, whole, for `omni dossier get` (src/dossier/api.ts,
// PRD 1548).
export const maxDuration = 60;

export function GET(request: Request) {
  return getDossier(request, dossierDeps());
}
