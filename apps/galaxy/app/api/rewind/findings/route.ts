import { rewindDeps } from '../../../../src/rewind/rewind-live';
import { postRewindFindings } from '../../../../src/rewind/rewind.controller';

// POST /api/rewind/findings {repo, prd, findings} → 200 {added}: the rewind's findings, proposed for a member
// to approve or reject, for `omni rewind push` (src/rewind/rewind.controller.ts, PRD 2410).
export const maxDuration = 10;

export function POST(request: Request) {
  return postRewindFindings(request, rewindDeps());
}
