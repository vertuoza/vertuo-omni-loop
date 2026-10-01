import { readConstituents } from '../../../src/constituents/api';
import { constituentsDeps } from '../../../src/constituents/api-live';

// GET /api/constituents?repo=<owner/name> → 200 {state, product, statement, never, latestEventId}: the
// live Statement and Never lines of the repository's product, which `omni constituents` prints at every
// session's start (src/constituents/api.ts, PRD 871).
export const maxDuration = 60;

export function GET(request: Request) {
  return readConstituents(request, constituentsDeps());
}
