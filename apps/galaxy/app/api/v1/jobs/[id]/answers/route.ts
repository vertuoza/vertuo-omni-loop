import { answerJob } from '../../../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../../../src/public-api/public-api.live';

// POST /api/v1/jobs/{id}/answers {answers, acting_for?} → 202 job: answers the questions of a runner job a key of
// the workspace queued, one answer to each, and queues the job that resumes it as the key that sent it
// (`continues` is the first job); a second answer or dismissal is 409 `conflict`, a job that asked none, another
// workspace's job or a person's 404, a key off the job's repository allow-list 403
// (src/public-api/public-api.controller.ts, PRD 2425 s6).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return answerJob(request, (await params).id, publicApiDeps());
}
