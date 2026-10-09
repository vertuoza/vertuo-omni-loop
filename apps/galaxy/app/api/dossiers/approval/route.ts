import { approveDossier, answerApproval } from '../../../../src/approval/approval-api';
import { approvalDeps } from '../../../../src/approval/approval-live';

// GET /api/dossiers/approval?repo=<owner/name>&prd=<n> → 200 {url, approval}: the approval in force of a
// PRD born on the server, for `omni approval`. POST /api/dossiers/approval {dossier} → 201 {url, approval}:
// a member approves it, and its issue gets the approved label (src/approval/approval-api.ts, PRD 1299).
export const maxDuration = 60;

export function GET(request: Request) {
  return answerApproval(request, approvalDeps());
}

export function POST(request: Request) {
  return approveDossier(request, approvalDeps());
}
