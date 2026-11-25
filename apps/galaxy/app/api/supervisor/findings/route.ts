import { supervisorDeps } from '../../../../src/supervisor/api/supervisor.live';
import { supervisorFindings, supervisorRaise } from '../../../../src/supervisor/api/supervisor.controller';

// GET /api/supervisor/findings → 200 {findings}, for the seat or a member; POST → 200 {finding, raised, notified}, the
// seat raises one (src/supervisor/api/supervisor.controller.ts, PRD omni-loop-34 s3).
export const maxDuration = 30;

export function GET(request: Request) {
  return supervisorFindings(request, supervisorDeps());
}

export function POST(request: Request) {
  return supervisorRaise(request, supervisorDeps());
}
