import { getJobQuestions } from '../../../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../../../src/public-api/public-api.live';

// GET /api/v1/jobs/{id}/questions → 200 {lead, questions, state, answers, closed_by}: what a runner job a key of
// the workspace queued asked, where it stands (open, answered or dismissed), the answers once given, and who
// closed it, a key by its name and whom it acted for, or a person by login; a job that asked none, another
// workspace's job, or a person's, is 404, a key off the job's repository allow-list 403
// (src/public-api/public-api.controller.ts, PRD 2425 s6).
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return getJobQuestions(request, (await params).id, publicApiDeps());
}
