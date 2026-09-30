import { readBusiness } from '../../../src/business-api/api';
import { businessDeps } from '../../../src/business-api/api-live';

// GET /api/business?repo=<owner/name> → 200 {state, business, product, claims, personas}: the confirmed
// and contradicted claims agents in that repository read, each with its state, and its product's
// personas (src/business-api/api.ts, PRD 748, PRD 774, PRD 799).
export const maxDuration = 60;

export function GET(request: Request) {
  return readBusiness(request, businessDeps());
}
