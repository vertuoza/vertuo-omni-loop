import { requestDeps } from '../../../../../src/approvals/approvals-live';
import { requestApproval } from '../../../../../src/approvals/approvals.controller';

// POST /api/dossiers/approval/request {repo, prd} → 200 {asked, nobodyElse, author, product}: `omni wait
// approval` asks a ◆ PRD's approvers, each reached by the channels they turned on
// (src/approvals/approvals.controller.ts, PRD 1322 s2).
export const maxDuration = 60;

export function POST(request: Request) {
  return requestApproval(request, requestDeps());
}
