import { waitingDeps } from '../../../../src/approvals/approvals-live';
import { approvalsWaiting } from '../../../../src/approvals/approvals.controller';

// GET /api/waiting/approvals → 200 {items} | 401 {error} | 500 {error}: the approval requests waiting on
// the signed-in member, the bell's Approvals group (src/approvals/approvals.controller.ts, PRD 1322 s2).
export const maxDuration = 60;

export function GET() {
  return approvalsWaiting(waitingDeps());
}
