import { getJobLines } from '../../../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../../../src/public-api/public-api.live';

// GET /api/v1/jobs/{id}/lines → 200 {data: [{seq, text}], next_cursor}: the live lines of a runner job a key of
// the workspace queued, oldest first, a page at a time; a job past its retention answers an empty `data`;
// another workspace's job, or a person's, is 404, a key off the job's repository allow-list 403
// (src/public-api/public-api.controller.ts, PRD 2425 s4).
export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return getJobLines(request, (await params).id, publicApiDeps());
}
