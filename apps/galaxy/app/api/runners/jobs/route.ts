import { runnersDeps } from '../../../../src/runners/runners.live';
import { sendJob } from '../../../../src/runners/runners.controller';

// POST /api/runners/jobs {line, repo, target} → 200 {job}: Send to terminal queues a job, with the
// page's session (src/runners/runners.controller.ts, PRD 1830 s1).
export const maxDuration = 30;

export function POST(request: Request) {
  return sendJob(request, runnersDeps());
}
