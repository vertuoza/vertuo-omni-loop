import { loopReadsDeps } from '../../../../src/loop/loop-reads-live';
import { readChanges } from '../../../../src/loop/loop.controller';

// GET /api/loop/changes?repo=<owner/name>&base|head|label&state=all|open → 200 {changes}: the kit reads
// a repository's changes from the Omni page instead of `gh` (src/loop/loop.controller.ts, PRD 1665 s1).
export const maxDuration = 30;

export function GET(request: Request) {
  return readChanges(request, loopReadsDeps());
}
