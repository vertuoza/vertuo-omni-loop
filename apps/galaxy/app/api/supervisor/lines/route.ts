import { supervisorDeps } from '../../../../src/supervisor/api/supervisor.live';
import { supervisorLines } from '../../../../src/supervisor/api/supervisor.controller';

// GET /api/supervisor/lines?runner=<id>&job=<id>&after=<seq> → 200 {lines}: a job's lines, masked, for the seat of its
// workspace (src/supervisor/api/supervisor.controller.ts, PRD omni-loop-34 s3).
export const maxDuration = 30;

export function GET(request: Request) {
  return supervisorLines(request, supervisorDeps());
}
