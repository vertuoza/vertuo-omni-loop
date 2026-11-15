import { dropMission } from '../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../src/missions/missions.live';

// POST /api/missions/drop {repo, mission, prd, keep} → 200 {drop: {…}}: a member signed in at the terminal asks for a PRD to leave
// its mission's branch (src/missions/missions.controller.ts, PRD 2896 s7).
export const maxDuration = 30;

export async function POST(request: Request) {
  return dropMission(request, missionsDeps());
}
