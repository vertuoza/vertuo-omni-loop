import { runnersDeps } from '../../../../../../src/runners/runners.live';
import { askQuestions, readQuestions } from '../../../../../../src/runners/runners.controller';

// POST /api/runners/jobs/<id>/questions {issue, lead, questions} → 200 the questions, open: a running job
// asks them once, with the kit's sign-in of its runner's owner. GET → 200 the questions, and the answers
// once someone gave them, for a member of the job's workspace with the page's session, or a runner's owner
// with the kit's sign-in; 404 to anyone else (src/runners/runners.controller.ts, PRD 2255).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return askQuestions(request, (await params).id, runnersDeps());
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return readQuestions(request, (await params).id, runnersDeps());
}
