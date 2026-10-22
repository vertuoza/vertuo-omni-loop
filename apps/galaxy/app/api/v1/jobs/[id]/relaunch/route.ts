import { relaunchJob } from '../../../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../../../src/public-api/public-api.live';

// POST /api/v1/jobs/{id}/relaunch {acting_for?} → 202 job: sends a runner job a key of the workspace queued again
// (failed or cancelled) or resumes it (stopped mid-way), as the Runners page offers; the new job continues the first,
// stays the first key's and keeps its notify_url. A job the page offers neither for, or one carried on already, is
// 409 `conflict`, another workspace's job or a person's 404, a key off the job's repository allow-list 403
// (src/public-api/public-api.controller.ts, PRD 2425 s7).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return relaunchJob(request, (await params).id, publicApiDeps());
}
