import { runnersDeps } from '../../../../../src/runners/runners.live';
import { reportHealth } from '../../../../../src/runners/runners.controller';

// POST /api/runners/<id>/health {cpu, load1, cores, memUsed, memTotal, diskFree, diskTotal, paused?, limits?}
// → 200 {at}: a runner's machine, every 15 s, with the kit's sign-in (src/runners/runners.controller.ts,
// PRD 2102 s1).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return reportHealth(request, (await params).id, runnersDeps());
}
