import { judgeDeps } from '../../../../src/jev/decisions/judge-live';
import { judgeRoute } from '../../../../src/jev/decisions/judge-route';

// POST /api/constituents/judge {repo, state, old, ref?} → 200 {answer, confidence, decidedBy}: omni-app's
// canon gate asks the workspace's `constituent-break` Jev decision, signed with an HMAC over the body
// under CONSTITUENT_JUDGE_SECRET (src/jev/decisions/judge-route.ts, PRD 871 s4).
export const maxDuration = 60;

export async function POST(request: Request) {
  return judgeRoute(request, judgeDeps());
}
