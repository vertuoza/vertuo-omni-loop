import { postVirtualFleet } from '../../../src/virtual-fleets/virtual-fleets.controller';
import { virtualFleetsDeps } from '../../../src/virtual-fleets/virtual-fleets.live';

// POST /api/virtual-fleets {workspace, name, mascot, roles} → 201 {fleet}: any member of the workspace
// makes a Virtual Fleet with a hero per role left on, from the Fleet section's New virtual fleet drawer
// (src/virtual-fleets/virtual-fleets.controller.ts, PRD 2842 s1).
export const maxDuration = 30;

export function POST(request: Request) {
  return postVirtualFleet(request, virtualFleetsDeps());
}
