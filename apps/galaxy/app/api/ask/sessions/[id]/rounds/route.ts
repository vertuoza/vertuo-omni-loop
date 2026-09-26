import { addRound } from '../../../../../../src/ask/api';
import { askDeps } from '../../../../../../src/ask/api-live';

// POST /api/ask/sessions/:id/rounds {questions} → {roundId}: asks a round, its questions stored as
// given (src/ask/api.ts).
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return addRound(request, (await params).id, askDeps());
}
