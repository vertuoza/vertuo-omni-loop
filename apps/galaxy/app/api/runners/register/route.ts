import { runnersDeps } from '../../../../src/runners/runners.live';
import { registerRunner } from '../../../../src/runners/runners.controller';

// POST /api/runners/register {name, slots, repos, version} → 200 {id, name, fleet}: `omni runner`
// registers its machine, or registers it again by name, with the kit's sign-in
// (src/runners/runners.controller.ts, PRD 1830 s1).
export const maxDuration = 30;

export function POST(request: Request) {
  return registerRunner(request, runnersDeps());
}
