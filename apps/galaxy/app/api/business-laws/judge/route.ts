import { businessLawsJudgeRoute } from '../../../../src/business-laws/judge-route';
import { businessLawsJudgeDeps } from '../../../../src/business-laws/judge-route-live';

// POST /api/business-laws/judge {repo, spec} → 200 {state, reason, laws, domains, findings}: omni-app's inbox
// check judges a phase-0 pull request's spec against its product's business laws, signed with an HMAC over the
// body under BUSINESS_LAWS_JUDGE_SECRET (src/business-laws/judge-route.ts, PRD 2632 s5).
export const maxDuration = 60;

export async function POST(request: Request) {
  return businessLawsJudgeRoute(request, businessLawsJudgeDeps());
}
