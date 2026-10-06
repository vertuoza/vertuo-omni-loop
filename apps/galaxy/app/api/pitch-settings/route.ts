import { readPitchSettings } from '../../../src/products/pitch-settings-api';
import { pitchSettingsDeps } from '../../../src/products/pitch-look-live';

// GET /api/pitch-settings?repo=<owner/name> → 200 {settings}: the Pitch settings of the repository's
// product, filled from its preset and the defaults (src/products/pitch-settings-api.ts, PRD 1108).
export const maxDuration = 60;

export function GET(request: Request) {
  return readPitchSettings(request, pitchSettingsDeps());
}
