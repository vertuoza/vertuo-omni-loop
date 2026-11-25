import { sendBackMission } from '../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../src/missions/missions.live';

// POST /api/missions/send-back {repo, mission, prd} → 200 {sentBack: {mission, prd}}: a member signed in at the terminal sends a PM product PRD
// that waits on them back to the PM (src/missions/missions.controller.ts, bug #3302).
export const maxDuration = 30;

export async function POST(request: Request) {
  return sendBackMission(request, missionsDeps());
}
