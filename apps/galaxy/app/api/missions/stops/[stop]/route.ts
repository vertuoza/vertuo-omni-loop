import { answerBudgetStop } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/stops/<stop> {answer, tokens?} → 200 {stop: {id, answer, raisedTo}}: a member answers a budget stop, once, as
// themselves; an owner alone raises the cap (src/missions/missions.controller.ts, PRD 3040 s4).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ stop: string }> }) {
  return answerBudgetStop((await params).stop, request, missionsDeps());
}
