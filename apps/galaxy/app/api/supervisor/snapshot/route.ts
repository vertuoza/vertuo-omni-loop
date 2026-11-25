import { supervisorDeps } from '../../../../src/supervisor/api/supervisor.live';
import { supervisorSnapshot } from '../../../../src/supervisor/api/supervisor.controller';

// GET /api/supervisor/snapshot?runner=<id> → 200: what the seat reads on a look (src/supervisor/api/supervisor.controller.ts, PRD omni-loop-34 s3).
export const maxDuration = 30;

export function GET(request: Request) {
  return supervisorSnapshot(request, supervisorDeps());
}
