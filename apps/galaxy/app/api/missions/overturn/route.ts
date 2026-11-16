import { overturnMission } from '../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../src/missions/missions.live';

// POST /api/missions/overturn {repo, mission, decision} → 200 {overturn: {…}}: a member signed in at the terminal overturns a decision the
// mission's fleet carried (src/missions/missions.controller.ts, PRD 2896 s11).
export const maxDuration = 30;

export async function POST(request: Request) {
  return overturnMission(request, missionsDeps());
}
