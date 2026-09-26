import { waitRound } from '../../../../../../src/ask/api';
import { askDeps } from '../../../../../../src/ask/api-live';

// GET /api/ask/rounds/:id/wait → {status: open|answered|abandoned|closed, answers?}: holds up to
// 50 s for the answer (src/ask/api.ts), inside this route's 60 s.
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return waitRound(request, (await params).id, askDeps());
}
