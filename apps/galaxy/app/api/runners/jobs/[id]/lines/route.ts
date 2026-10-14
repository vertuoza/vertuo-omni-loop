import { runnersDeps } from '../../../../../../src/runners/runners.live';
import { jobLines } from '../../../../../../src/runners/runners.controller';

// GET /api/runners/jobs/<id>/lines?after=<seq> → 200 {status, lines, more, first, logTail}: a job's live
// lines after `after`, at most 5,000, for a member of its workspace, with the page's session; 404 to
// anyone else (src/runners/runners.controller.ts, PRD 1904).
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return jobLines(request, (await params).id, runnersDeps());
}
