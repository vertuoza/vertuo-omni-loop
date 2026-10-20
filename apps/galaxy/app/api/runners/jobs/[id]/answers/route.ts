import { runnersDeps } from '../../../../../../src/runners/runners.live';
import { answerQuestions } from '../../../../../../src/runners/runners.controller';

// POST /api/runners/jobs/<id>/answers {answers} → 200 {job}: a member answers a job's questions, with the
// page's session only (a token is a 403, BR-PRODUCT-94); the answers and the job that resumes the run are
// stored together, and the first answer wins (src/runners/runners.controller.ts, PRD 2255).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return answerQuestions(request, (await params).id, runnersDeps());
}
