import { rewindDeps } from '../../../../src/rewind/rewind-live';
import { getRewindFacts } from '../../../../src/rewind/rewind.controller';

// GET /api/rewind/facts?repo=<owner/name>&prd=<n> → 200 {watches, breaks, findings}: a PRD's watch on main,
// its breaks and the rewind's findings, for `omni rewind facts` (src/rewind/rewind.controller.ts, PRD 2410).
export const maxDuration = 10;

export function GET(request: Request) {
  return getRewindFacts(request, rewindDeps());
}
