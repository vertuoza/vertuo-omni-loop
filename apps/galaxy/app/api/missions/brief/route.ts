import { readMissionBrief } from '../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../src/missions/missions.live';

// GET /api/missions/brief?repo=<owner/name>&mission=<n> → 200 {mission: {…}}: a member signed in at the terminal reads a mission's brief
// and retros as its page holds them (src/missions/missions.controller.ts, PRD 3194).
export const maxDuration = 30;

export async function GET(request: Request) {
  return readMissionBrief(request, missionsDeps());
}
