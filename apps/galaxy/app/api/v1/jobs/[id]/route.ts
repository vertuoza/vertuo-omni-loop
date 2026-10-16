import { getJob } from '../../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../../src/public-api/public-api.live';

// GET /api/v1/jobs/{id} → 200 job: a runner job a key of the workspace queued, status, runner, pull
// request link, exit code, reason and times; another workspace's job, or a person's, is 404
// (src/public-api/public-api.controller.ts, PRD 2022 s4).
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return getJob(request, (await params).id, publicApiDeps());
}
