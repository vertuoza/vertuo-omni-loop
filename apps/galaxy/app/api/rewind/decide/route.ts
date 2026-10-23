import { decisionDeps } from '../../../../src/rewind/rewind-live';
import { postRewindDecision } from '../../../../src/rewind/rewind.controller';

// POST /api/rewind/decide {finding, verdict, reason?} → 200 {state, followUp}: a member approves or rejects a
// proposed finding of the Main tab, once, with the page's session; Approve then sends its work
// (src/rewind/rewind.controller.ts, PRD 2410 s7).
export const maxDuration = 15;

export function POST(request: Request) {
  return postRewindDecision(request, decisionDeps());
}
