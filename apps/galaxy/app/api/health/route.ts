import { healthResponse, liveHealth } from '../../../src/health/health.service';

// GET /api/health → 200 or 503 {ok, app, commit, checks}, never cached: whether this deployment's
// environment parses and its database answers, and which commit is live (src/health/health.service.ts,
// PRD 1723 s3). Public: it names checks only, never a value or an error's text. Any other method is 405.
export const maxDuration = 10;

export function GET() {
  return healthResponse(liveHealth());
}
