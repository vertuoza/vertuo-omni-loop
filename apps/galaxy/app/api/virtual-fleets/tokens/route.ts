import { postFleetTokens } from '../../../../src/virtual-fleets/virtual-fleets.controller';
import { virtualFleetsDeps } from '../../../../src/virtual-fleets/virtual-fleets.live';

// POST /api/virtual-fleets/tokens {workspace, fleet, tokens} → 200 {fleet: {name, dailyTokens}}: a workspace owner sets a virtual
// fleet's daily token cap, null for none (src/virtual-fleets/virtual-fleets.controller.ts, PRD 3040 s4).
export const maxDuration = 30;

export function POST(request: Request) {
  return postFleetTokens(request, virtualFleetsDeps());
}
