import { loopReadsDeps } from '../../../../../src/loop/loop-reads-live';
import { readChange } from '../../../../../src/loop/loop.controller';

// GET /api/loop/changes/<n>?repo=<owner/name> → 200 one change, with lastCommitAt and files: the kit
// reads one change from the Omni page instead of `gh` (src/loop/loop.controller.ts, PRD 1665 s1).
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ n: string }> }) {
  return readChange(request, (await params).n, loopReadsDeps());
}
