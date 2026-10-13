import { runnersDeps } from '../../../../src/runners/runners.live';
import { setRunnerFleet } from '../../../../src/runners/runners.controller';

// PATCH /api/runners/<id> {fleet} → 200 {runner}: a workspace owner gives a runner to a fleet, or makes
// it shared, with the page's session (src/runners/runners.controller.ts, PRD 1830 s1).
export const maxDuration = 30;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return setRunnerFleet(request, (await params).id, runnersDeps());
}
