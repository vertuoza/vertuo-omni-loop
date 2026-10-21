import { runnersDeps } from '../../../../src/runners/runners.live';
import { prdJobs, sendJob } from '../../../../src/runners/runners.controller';

// POST /api/runners/jobs {line, repo, target} → 200 {job}: Send to terminal queues a job, with the
// page's session (src/runners/runners.controller.ts, PRD 1830 s1).
// GET /api/runners/jobs?repo=<owner/name>&prd=<n> → 200 {jobs}: the PRD's jobs in the repository, newest
// first, for a member of its workspace, with the kit's sign-in (PRD 2251).
export const maxDuration = 30;

export function POST(request: Request) {
  return sendJob(request, runnersDeps());
}

export function GET(request: Request) {
  return prdJobs(request, runnersDeps());
}
