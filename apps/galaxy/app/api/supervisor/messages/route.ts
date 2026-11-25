import { supervisorDeps } from '../../../../src/supervisor/api/supervisor.live';
import { supervisorMessages, supervisorSay } from '../../../../src/supervisor/api/supervisor.controller';

// GET /api/supervisor/messages → 200 {messages}: a thread; POST → the seat answers, or an owner writes
// (src/supervisor/api/supervisor.controller.ts, PRD omni-loop-34 s3).
export const maxDuration = 30;

export function GET(request: Request) {
  return supervisorMessages(request, supervisorDeps());
}

export function POST(request: Request) {
  return supervisorSay(request, supervisorDeps());
}
