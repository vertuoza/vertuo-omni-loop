import { postCommanderMessage } from '../../../../../src/virtual-fleets/commander/commander.controller';
import { commanderDeps } from '../../../../../src/virtual-fleets/commander/commander.live';

// POST /api/virtual-fleets/commander/message {workspace, fleet, text} → 201 {message}: a member tells a Virtual Fleet's
// agents something, as themselves; its running missions' next jobs read it (src/virtual-fleets/commander/commander.controller.ts,
// PRD 3107 s3). No model is asked.
export const maxDuration = 30;

export function POST(request: Request) {
  return postCommanderMessage(request, commanderDeps());
}
