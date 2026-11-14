import { deleteHero, postHero } from '../../../../src/virtual-fleets/heroes/heroes.controller';
import { heroesDeps } from '../../../../src/virtual-fleets/heroes/heroes.live';

// POST /api/virtual-fleets/heroes {workspace, fleet, role} → 201 {hero}, and DELETE {workspace, hero} → 200
// {removed}: an owner of the workspace adds or removes a Virtual Hero from the Fleet section's Heroes tab
// (src/virtual-fleets/heroes/heroes.controller.ts, PRD 2842 s6).
export const maxDuration = 30;

export function POST(request: Request) {
  return postHero(request, heroesDeps());
}

export function DELETE(request: Request) {
  return deleteHero(request, heroesDeps());
}
