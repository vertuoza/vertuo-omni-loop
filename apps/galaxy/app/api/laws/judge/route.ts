import { lawJudgeDeps } from '../../../../src/jev/decisions/judge-live';
import { lawJudgeRoute } from '../../../../src/jev/decisions/law-judge-route';

// POST /api/laws/judge {repo, state, old, ref?} → 200 {answer, confidence, decidedBy}: omni-app's harvest
// asks the workspace's `law-worth` Jev decision, signed with an HMAC over the body under LAW_JUDGE_SECRET
// (src/jev/decisions/law-judge-route.ts, PRD 1342 s3).
export const maxDuration = 60;

export async function POST(request: Request) {
  return lawJudgeRoute(request, lawJudgeDeps());
}
