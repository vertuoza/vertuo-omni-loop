import { stopStuckMission } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/<id>/stop → 200 {mission: {id, status}}: a member stops a mission paused by stuck, saying it was stuck
// (src/missions/missions.controller.ts, PRD 3065 s5).
export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return stopStuckMission((await params).id, missionsDeps());
}
