import { listBugFixes, startBugFix } from '../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../src/public-api/public-api.live';

// GET /api/v1/bug-fixes?limit=&cursor= → 200 {data, next_cursor}: the workspace's bug fixes, newest
// first, for a program with its API key (src/public-api/public-api.controller.ts, PRD 2022 s2).
// POST /api/v1/bug-fixes {repo, description, runner?, fleet?} → 202 job: queues /omni:bug-fix on the
// runners (PRD 2022 s4).
export const maxDuration = 30;

export function GET(request: Request) {
  return listBugFixes(request, publicApiDeps());
}

export function POST(request: Request) {
  return startBugFix(request, publicApiDeps());
}
