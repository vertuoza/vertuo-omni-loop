import { readBusiness } from '../../../src/business-api/api';
import { businessDeps } from '../../../src/business-api/api-live';

// GET /api/business?repo=<owner/name> → 200 {state, business, product, claims}: the confirmed claims
// agents in that repository read (src/business-api/api.ts, PRD 748).
export const maxDuration = 60;

export function GET(request: Request) {
  return readBusiness(request, businessDeps());
}
