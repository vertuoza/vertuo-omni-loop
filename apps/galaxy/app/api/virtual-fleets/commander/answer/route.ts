import { postCommanderAnswer } from '../../../../../src/virtual-fleets/commander/commander.controller';
import { commanderDeps } from '../../../../../src/virtual-fleets/commander/commander.live';

// POST /api/virtual-fleets/commander/answer {workspace, fleet, source, id, choice} → 200 {card}: a member answers a card
// of a Virtual Fleet's Waiting on you rail, as themselves, through the question's own answer route
// (src/virtual-fleets/commander/commander.controller.ts, PRD 3107 s2).
export const maxDuration = 30;

export function POST(request: Request) {
  return postCommanderAnswer(request, commanderDeps());
}
