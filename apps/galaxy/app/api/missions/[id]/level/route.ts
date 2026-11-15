import { levelMission } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/<id>/level {level} → 200 {mission: {id, level}}: a member of the mission's workspace changes
// the level it runs at; only an owner takes it above its fleet's (src/missions/missions.controller.ts, PRD 2896 s2).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return levelMission((await params).id, request, missionsDeps());
}
