import { recheckDeps } from '../../../../src/business/recheck/live';
import { recheckRoute } from '../../../../src/business/recheck/recheck';

// POST /api/business/recheck, `Authorization: Bearer <BUSINESS_RECHECK_SECRET>` → 200 {rechecked_at,
// rechecked, skipped} | 401 | 500: every business with a confirmed claim drafted again
// (src/business/recheck/recheck.ts, PRD 774 s4). Called every Sunday at 22:00 UTC by
// .github/workflows/business-recheck.yml. It reads every such workspace's repositories and web pages, so
// it is given longer than the other routes.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return recheckRoute(request, recheckDeps());
}
