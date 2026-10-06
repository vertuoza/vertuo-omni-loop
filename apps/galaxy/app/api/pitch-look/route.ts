import { readPitchLook } from '../../../src/products/pitch-settings-api';
import { pitchSettingsDeps } from '../../../src/products/pitch-look-live';

// GET /api/pitch-look?repo=<owner/name> → 200 {look}: PRD 859's read, kept as an alias of
// /api/pitch-settings — the preset (arcade or keynote) the repository's product's look was filled from,
// arcade for a repository with no product (src/products/pitch-settings-api.ts, PRD 1108).
export const maxDuration = 60;

export function GET(request: Request) {
  return readPitchLook(request, pitchSettingsDeps());
}
