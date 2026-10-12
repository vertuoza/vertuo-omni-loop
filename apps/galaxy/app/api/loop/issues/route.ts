import { loopReadsDeps } from '../../../../src/loop/loop-reads-live';
import { readIssues } from '../../../../src/loop/loop.controller';

// GET /api/loop/issues?repo=<owner/name>&label&state=all|open|closed → 200 {issues}: the kit reads a
// repository's issues from the Omni page instead of `gh` (src/loop/loop.controller.ts, PRD 1665 s2).
export const maxDuration = 30;

export function GET(request: Request) {
  return readIssues(request, loopReadsDeps());
}
