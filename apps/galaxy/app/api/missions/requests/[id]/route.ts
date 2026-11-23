import { readRequest } from '../../../../../src/missions/request.controller';
import { requestDeps } from '../../../../../src/missions/request.live';

// GET /api/missions/requests/<id> → 200 {request: {id, repo, fleet, goal, requestedBy, mission, createdAt}}: what
// `omni mission request <id>` reads, for a member of the request's workspace or their runner (src/missions/request.controller.ts,
// PRD omni-loop-24 s3).
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return readRequest((await params).id, request, requestDeps());
}
