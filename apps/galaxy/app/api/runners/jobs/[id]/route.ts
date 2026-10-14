import { runnersDeps } from '../../../../../src/runners/runners.live';
import { reportJob } from '../../../../../src/runners/runners.controller';

// POST /api/runners/jobs/<id> {status, logTail?, from?, lines?, prUrl?, exitCode?, reason?} → 200 {cancel}:
// a runner's report on a job it claimed, with the kit's sign-in (src/runners/runners.controller.ts, PRD
// 1830 s1); `from` and `lines` carry its live lines (PRD 1904).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return reportJob(request, (await params).id, runnersDeps());
}
