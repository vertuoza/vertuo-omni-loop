import { moveMission } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/<id>/resume → 200 {mission: {id, status}}: a member of the mission's workspace moves it
// (src/missions/missions.controller.ts, PRD 2842 s5).
export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return moveMission('resume', (await params).id, missionsDeps());
}
