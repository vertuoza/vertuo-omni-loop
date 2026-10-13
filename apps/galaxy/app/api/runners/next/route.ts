import { runnersDeps } from '../../../../src/runners/runners.live';
import { nextJob } from '../../../../src/runners/runners.controller';

// GET /api/runners/next?runner=<id> → 200 {id, line, repo, sentBy} | 204: a runner's check-in, held up
// to 50 s for a job it may claim, with the kit's sign-in (src/runners/runners.controller.ts, PRD 1830 s1).
export const maxDuration = 60;

export function GET(request: Request) {
  return nextJob(request, runnersDeps());
}
