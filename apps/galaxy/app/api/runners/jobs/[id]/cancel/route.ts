import { runnersDeps } from '../../../../../../src/runners/runners.live';
import { cancelJob } from '../../../../../../src/runners/runners.controller';

// POST /api/runners/jobs/<id>/cancel → 200 {job}: the sender or a workspace owner cancels a job, with
// the page's session (src/runners/runners.controller.ts, PRD 1830 s1).
export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return cancelJob((await params).id, runnersDeps());
}
