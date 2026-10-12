import { loopReadsDeps } from '../../../../../src/loop/loop-reads-live';
import { readIssue } from '../../../../../src/loop/loop.controller';

// GET /api/loop/issues/<n>?repo=<owner/name> → 200 one issue, with its comments and the changes that
// close it: the kit reads one issue from the Omni page instead of `gh` (src/loop/loop.controller.ts,
// PRD 1665 s2).
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ n: string }> }) {
  return readIssue(request, (await params).n, loopReadsDeps());
}
