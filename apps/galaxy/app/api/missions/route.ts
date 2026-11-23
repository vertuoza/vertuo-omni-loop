import { makeRequest } from '../../../src/missions/request.controller';
import { requestDeps } from '../../../src/missions/request.live';

// POST /api/missions {workspace, fleet, goal, repo?} → 201 {request: {id, repo, fleet, goal, job}}: a member presses Start on the
// New mission box; the request is saved and /omni:mission --request <id> queued for the fleet's runners
// (src/missions/request.controller.ts, PRD omni-loop-24 s3).
export const maxDuration = 30;

export async function POST(request: Request) {
  return makeRequest(request, requestDeps());
}
