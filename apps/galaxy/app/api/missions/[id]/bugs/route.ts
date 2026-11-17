import { pickBugs } from '../../../../../src/missions/missions.controller';
import { missionsDeps } from '../../../../../src/missions/missions.live';

// POST /api/missions/<id>/bugs {prd, pick} → 200 {bugs: {mission, prd, pick}}: a member of the mission's workspace picks on Decide the bugs,
// Send on to the Reviewer or Stop this PRD (src/missions/missions.controller.ts, PRD 3001).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return pickBugs((await params).id, request, missionsDeps());
}
