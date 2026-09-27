import { deleteSession } from '../../../../../src/ask/api';
import { askDeps } from '../../../../../src/ask/api-live';

// DELETE /api/ask/sessions/:id → {id, deleted: true}: the owner deletes the session and its rounds
// for good (src/ask/api.ts).
export const maxDuration = 60;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return deleteSession(request, (await params).id, askDeps());
}
