import { supervisorDeps } from '../../../../src/supervisor/api/supervisor.live';
import { supervisorNext } from '../../../../src/supervisor/api/supervisor.controller';

// GET /api/supervisor/next?runner=<id>&since=<time> → 200 {at, wake, seat} | 204: the Supervisor seat's look, held up to
// 40 s for a new signal, an owner's message or a pressed suggestion (src/supervisor/api/supervisor.controller.ts, PRD omni-loop-34 s3).
export const maxDuration = 60;

export function GET(request: Request) {
  return supervisorNext(request, supervisorDeps());
}
