import { answerRound } from '../../../../../../src/ask/api';
import { askDeps } from '../../../../../../src/ask/api-live';

// POST /api/ask/rounds/:id/answers {answers, via: "terminal"}: records an answer given in the
// terminal (src/ask/api.ts).
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return answerRound(request, (await params).id, askDeps());
}
