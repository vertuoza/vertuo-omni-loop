import { sendBackFromTab } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/<id>/send-back {prd} → 200 {sentBack: {mission, prd}}: a member of the mission's workspace presses Send back to the PM on
// a PM product PRD that waits on them (src/missions/missions.controller.ts, bug #3302).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return sendBackFromTab((await params).id, request, missionsDeps());
}
