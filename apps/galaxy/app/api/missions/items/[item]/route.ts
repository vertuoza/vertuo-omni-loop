import { answerMissionItem } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/items/<item> {answer, note?} → 200 {item: {id, answer}}: a member adopts or declines a mission item, once, as
// themselves; adopting applies nothing (src/missions/missions.controller.ts, PRD 3065 s5).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ item: string }> }) {
  return answerMissionItem((await params).item, request, missionsDeps());
}
