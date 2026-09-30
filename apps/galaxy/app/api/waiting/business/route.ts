import { businessCountDeps } from '../../../../src/waiting/business-live';
import { waitingBusiness } from '../../../../src/waiting/business-count';

// GET /api/waiting/business → 200 {count} | 401 {error} | 500 {error}: how many things wait to be
// checked on Settings › Business for the signed-in member (src/waiting/business-count.ts, PRD 774 s5),
// the bell's "Business · N to check" group.
export const maxDuration = 60;

export function GET() {
  return waitingBusiness(businessCountDeps());
}
