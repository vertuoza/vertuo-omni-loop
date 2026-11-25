import { proposalsDeps } from '../../../../src/supervisor/proposals/proposals.live';
import { supervisorPress } from '../../../../src/supervisor/proposals/proposals.controller';

// POST /api/supervisor/proposals {workspace, proposal} → 200 {press}: an owner presses a Supervisor suggestion, carried out
// through today's route as that owner (src/supervisor/proposals/proposals.controller.ts, PRD omni-loop-34 s7).
export const maxDuration = 30;

export function POST(request: Request) {
  return supervisorPress(request, proposalsDeps());
}
