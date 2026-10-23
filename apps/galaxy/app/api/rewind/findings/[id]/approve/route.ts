import { decisionDeps } from '../../../../../../src/rewind/rewind-live';
import { approveFinding } from '../../../../../../src/rewind/rewind.controller';

// POST /api/rewind/findings/<id>/approve → 200 {state, followUp}: a member approves a proposed finding of the
// Main tab, once, with the page's session (a token is a 403); Approve then queues its job, files its proposal
// or opens its issue on the kit's repository (src/rewind/rewind.controller.ts, PRD 2410 s7).
export const maxDuration = 15;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return approveFinding(request, (await params).id, decisionDeps());
}
