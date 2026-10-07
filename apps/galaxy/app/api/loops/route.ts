import { loopPush } from '../../../src/loop/api';
import { loopDeps } from '../../../src/loop/api-live';

// POST /api/loops {event: start | tick | park | stop, …} → 201 or 200 {loopId, state, planVersion}: the
// kit's `omni loop push` tells the app where a /omni:drive loop stands (src/loop/api.ts, PRD 1139).
export const maxDuration = 10;

export function POST(request: Request) {
  return loopPush(request, loopDeps());
}
