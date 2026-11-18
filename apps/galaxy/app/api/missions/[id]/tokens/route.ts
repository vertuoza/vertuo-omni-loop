import { budgetMission } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/<id>/tokens {tokens} → 200 {mission: {id, tokens}}: a member of the mission's workspace sets its token budget
// (null: none); only an owner changes it once the mission started (src/missions/missions.controller.ts, PRD 3040 s4).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return budgetMission((await params).id, request, missionsDeps());
}
