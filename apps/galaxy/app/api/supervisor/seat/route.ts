import { supervisorDeps } from '../../../../src/supervisor/api/supervisor.live';
import { supervisorSeat, supervisorSeatPost, supervisorSeatSet } from '../../../../src/supervisor/api/supervisor.controller';

// GET /api/supervisor/seat → 200 {seat}; POST → the seat checks in, or an owner places it; PATCH → an owner pauses it or
// sets its daily tokens (src/supervisor/api/supervisor.controller.ts, PRD omni-loop-34 s3).
export const maxDuration = 30;

export function GET(request: Request) {
  return supervisorSeat(request, supervisorDeps());
}

export function POST(request: Request) {
  return supervisorSeatPost(request, supervisorDeps());
}

export function PATCH(request: Request) {
  return supervisorSeatSet(request, supervisorDeps());
}
