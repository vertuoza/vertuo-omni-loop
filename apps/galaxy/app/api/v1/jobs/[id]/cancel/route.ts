import { cancelJob } from '../../../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../../../src/public-api/public-api.live';

// POST /api/v1/jobs/{id}/cancel {acting_for?} → 200 job: cancels a runner job a key of the workspace queued, as the
// Runners page's Cancel does: a queued or claimed job ends at once, a running one is asked to stop; an ended job is
// 409 `conflict`, another workspace's job or a person's 404, a key off the job's repository allow-list 403
// (src/public-api/public-api.controller.ts, PRD 2425 s7).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return cancelJob(request, (await params).id, publicApiDeps());
}
