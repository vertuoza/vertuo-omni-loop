import { receiveStageEvent } from '../../../../src/stages/event/event';
import { stageEventDeps } from '../../../../src/stages/event/live';

// POST /api/stages/event, signed by omni-app → 200 recorded | 202 not placed | 400 | 401 | 500: one PRD
// stage seen on a pull request, recorded before the next sync (src/stages/event/event.ts, PRD 587).
export async function POST(request: Request) {
  const { status, body } = await receiveStageEvent({ body: await request.text(), headers: request.headers }, stageEventDeps());
  return Response.json(body, { status });
}
