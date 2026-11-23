import { readMissionsOfPrd } from '../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../src/missions/missions.live';

// GET /api/missions/of-prd?repo=<owner/name>&prd=<n> → 200 {missions: [n…]}: a member signed in at the terminal reads which missions
// of a repository name a PRD (src/missions/missions.controller.ts, PRD 3194).
export const maxDuration = 30;

export async function GET(request: Request) {
  return readMissionsOfPrd(request, missionsDeps());
}
