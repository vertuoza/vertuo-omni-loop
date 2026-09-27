import { categorizeRound } from '../../../../../../src/ask/api';
import { askDeps } from '../../../../../../src/ask/api-live';

// PATCH /api/ask/rounds/:id/category {category} → {id, category, category_by}: any member of the
// session's workspace sorts a round into one of six, or clears it with null (src/ask/api.ts).
export const maxDuration = 60;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return categorizeRound(request, (await params).id, askDeps());
}
