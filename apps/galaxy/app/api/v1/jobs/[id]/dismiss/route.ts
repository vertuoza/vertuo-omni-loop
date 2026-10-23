import { dismissJob } from '../../../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../../../src/public-api/public-api.live';

// POST /api/v1/jobs/{id}/dismiss {acting_for?} → 200 job: closes the questions of a runner job a key of the
// workspace queued with no answer, and queues nothing; a second answer or dismissal is 409 `conflict`, a job that
// asked none, another workspace's job or a person's 404, a key off the job's repository allow-list 403
// (src/public-api/public-api.controller.ts, PRD 2425 s6).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return dismissJob(request, (await params).id, publicApiDeps());
}
