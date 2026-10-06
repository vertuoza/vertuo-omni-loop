import { readPitchLook } from '../../../src/products/pitch-look-api';
import { pitchLookDeps } from '../../../src/products/pitch-look-live';

// GET /api/pitch-look?repo=<owner/name> → 200 {look}: the pitch look of the repository's product,
// arcade for a repository with no product (src/products/pitch-look-api.ts, PRD 859).
export const maxDuration = 60;

export function GET(request: Request) {
  return readPitchLook(request, pitchLookDeps());
}
