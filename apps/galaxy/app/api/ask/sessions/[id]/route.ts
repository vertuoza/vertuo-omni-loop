import { deleteSession } from '../../../../../src/ask/api';
import { askDeps } from '../../../../../src/ask/api-live';

// GET /api/ask/sessions/:id → a session, its rounds and its heartbeat, polled by its ask page every
// 2 s (PRD 1318, src/ask/ask.controller.ts).
// DELETE /api/ask/sessions/:id → {id, deleted: true}: the owner deletes the session and its rounds
// for good (src/ask/api.ts).
export { getSession as GET } from '../../../../../src/ask/ask.controller';

export const maxDuration = 60;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return deleteSession(request, (await params).id, askDeps());
}
