import { decisionDeps } from '../../../../../../src/rewind/rewind-live';
import { rejectFinding } from '../../../../../../src/rewind/rewind.controller';

// POST /api/rewind/findings/<id>/reject {reason?} → 200 {state, followUp: null}: a member rejects a proposed
// finding of the Main tab, once, with its optional reason and the page's session (a token is a 403); it is
// kept, and never proposed again (src/rewind/rewind.controller.ts, PRD 2410 s7).
export const maxDuration = 10;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rejectFinding(request, (await params).id, decisionDeps());
}
