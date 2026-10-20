import { runnersDeps } from '../../../../../../src/runners/runners.live';
import { dismissQuestions } from '../../../../../../src/runners/runners.controller';

// POST /api/runners/jobs/<id>/dismiss → 200 the questions, dismissed: a member closes a job's questions
// with no answers and no job queued, with the page's session only (a token is a 403, BR-PRODUCT-94)
// (src/runners/runners.controller.ts, PRD 2255).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return dismissQuestions(request, (await params).id, runnersDeps());
}
