import { abandonRound } from '../../../../../../src/ask/api';
import { askDeps } from '../../../../../../src/ask/api-live';

// POST /api/ask/rounds/:id/abandon: the hook gave up waiting; the page shows "moved to the
// terminal" (src/ask/api.ts).
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return abandonRound(request, (await params).id, askDeps());
}
