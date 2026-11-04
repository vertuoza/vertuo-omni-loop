import { techDeps } from '../../../../../src/approvals/tech-live';
import { requestTechApproval, techMembers } from '../../../../../src/approvals/tech.controller';

// GET /api/dossiers/approval/tech?repo=&prd= → 200 {members}: the workspace's members who can be named.
// POST /api/dossiers/approval/tech {repo, prd, login} → 200 {login, state, url}: names one for the PRD's Tech
// Approval, reached by the channels they have on (src/approvals/tech.controller.ts, PRD 2608 s3).
export const maxDuration = 60;

export function GET(request: Request) {
  return techMembers(request, techDeps());
}

export function POST(request: Request) {
  return requestTechApproval(request, techDeps());
}
