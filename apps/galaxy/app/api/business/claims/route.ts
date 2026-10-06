import { addClaim } from '../../../../src/business-api/api';
import { businessDeps } from '../../../../src/business-api/api-live';

// POST /api/business/claims {repo, kind, value, state, ref} → 200 {id, state, added}: stores a claim a
// person gave as an answer in a skill run, `proposed` or `confirmed` (src/business-api/api.ts, PRD 822).
export const maxDuration = 60;

export function POST(request: Request) {
  return addClaim(request, businessDeps());
}
