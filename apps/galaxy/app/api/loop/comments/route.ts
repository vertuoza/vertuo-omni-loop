import { loopReadsDeps } from '../../../../src/loop/loop-reads-live';
import { readComments } from '../../../../src/loop/loop.controller';

// GET /api/loop/comments?repo=<owner/name>&on=<n> → 200 {comments}: the kit reads the conversation of an
// issue or a change from the Omni page instead of `gh` (src/loop/loop.controller.ts, PRD 1665 s2).
export const maxDuration = 30;

export function GET(request: Request) {
  return readComments(request, loopReadsDeps());
}
