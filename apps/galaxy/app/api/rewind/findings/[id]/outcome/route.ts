import { rewindDeps } from '../../../../../../src/rewind/rewind-live';
import { postFindingOutcome } from '../../../../../../src/rewind/rewind.controller';

// POST /api/rewind/findings/<id>/outcome {outcome, pr?, note?} → 200 {outcome}: records, once, what
// /omni:rewind-apply did with an approved finding, for `omni rewind outcome` (src/rewind/rewind.controller.ts,
// PRD 2498). The terminal's sign-in: an agent link or a member of the finding's workspace.
export const maxDuration = 10;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return postFindingOutcome(request, (await params).id, rewindDeps());
}
