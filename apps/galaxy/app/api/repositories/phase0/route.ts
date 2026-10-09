import { readPhase0 } from '../../../../src/repositories/phase0-api';
import { phase0Deps } from '../../../../src/repositories/phase0-live';

// GET /api/repositories/phase0?repo=<owner/name> → 200 {phase0: 'pr' | 'server'}: where the repository's
// phase 0 is approved, `pr` for one its workspace does not list (src/repositories/phase0-api.ts, PRD 1299).
export const maxDuration = 60;

export function GET(request: Request) {
  return readPhase0(request, phase0Deps());
}
