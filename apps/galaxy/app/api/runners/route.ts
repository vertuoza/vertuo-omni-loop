import { runnersDeps } from '../../../src/runners/runners.live';
import { listRunners } from '../../../src/runners/runners.controller';

// GET /api/runners?repo=<owner/name> → 200 {runners}: the runners of the repository's workspace, each with
// its name, fleet, state, slots used, slots and repositories, for a member, with the kit's sign-in
// (src/runners/runners.controller.ts, PRD 2251).
export const maxDuration = 30;

export function GET(request: Request) {
  return listRunners(request, runnersDeps());
}
