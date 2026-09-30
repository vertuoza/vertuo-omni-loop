import { suggestRivalsRoute } from '../../../../src/business/suggest-api';
import { suggestDeps } from '../../../../src/business/suggest-live';

// POST /api/business/suggest-rivals {workspace, product} → 200 {claims}: up to five rivals the small
// model guesses for the picked offering, trade and region, stored as proposed claims for Settings ›
// Business to show as guesses (src/business/suggest-api.ts, PRD 748 s3).
export const maxDuration = 60;

export function POST(request: Request) {
  return suggestRivalsRoute(request, suggestDeps());
}
