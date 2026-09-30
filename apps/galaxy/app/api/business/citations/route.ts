import { citeClaims } from '../../../../src/business-api/api';
import { businessDeps } from '../../../../src/business-api/api-live';

// POST /api/business/citations {repo, ids, by, ref?} → 200 {cited}: appends to the business's citation
// log the claims an agent cited (src/business-api/api.ts, PRD 748).
export const maxDuration = 60;

export function POST(request: Request) {
  return citeClaims(request, businessDeps());
}
