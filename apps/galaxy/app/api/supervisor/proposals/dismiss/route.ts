import { proposalsDeps } from '../../../../../src/supervisor/proposals/proposals.live';
import { supervisorDismiss } from '../../../../../src/supervisor/proposals/proposals.controller';

// POST /api/supervisor/proposals/dismiss {workspace, finding, reason?} → 200 {dismissed}: an owner says Not a problem
// (src/supervisor/proposals/proposals.controller.ts, PRD omni-loop-34 s7).
export const maxDuration = 30;

export function POST(request: Request) {
  return supervisorDismiss(request, proposalsDeps());
}
