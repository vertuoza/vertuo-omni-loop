import { decideDeps } from '../../../../src/jev/decisions/decide-live';
import { decideRoute } from '../../../../src/jev/decisions/decide-route';

// POST /api/decide/:decision {repo, state, old, ref?} → 200 {answer, confidence, decidedBy}: a Claude
// session asks the workspace's Jev decision with the terminal's sign-in; `omni decide` calls it
// (src/jev/decisions/decide-route.ts, PRD 812 s3).
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ decision: string }> }) {
  return decideRoute(request, (await params).decision, decideDeps());
}
