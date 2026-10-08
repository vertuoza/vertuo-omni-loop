import { startTick } from '../../../../src/roadmap/tick/tick';
import { tickDeps } from '../../../../src/roadmap/tick/tick-live';

// POST /api/roadmaps/tick {roadmap, row} → 200 {authorize}: GitHub's authorisation of the omni-loop App
// that posts the tick of a roadmap's `person` prerequisite as the signed-in member; its callback is the
// outbox send's, /prd/github/callback (src/roadmap/tick/tick.ts, PRD 1218 s7).
export function POST(request: Request) {
  return startTick(request, tickDeps());
}
