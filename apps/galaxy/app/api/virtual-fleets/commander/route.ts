import { getCommander, postCommander } from '../../../../src/virtual-fleets/commander/commander.controller';
import { commanderDeps } from '../../../../src/virtual-fleets/commander/commander.live';

// GET /api/virtual-fleets/commander?workspace=<id>&fleet=<key> → 200 {view}, and POST {workspace, fleet, text} → 201
// {question, reply}: a member of the workspace opens a Virtual Fleet's Commander tab and asks it a question
// (src/virtual-fleets/commander/commander.controller.ts, PRD 3107 s1). The model's call takes up to 30 seconds.
export const maxDuration = 60;

export function GET(request: Request) {
  return getCommander(request, commanderDeps());
}

export function POST(request: Request) {
  return postCommander(request, commanderDeps());
}
