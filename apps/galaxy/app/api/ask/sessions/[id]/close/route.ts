import { closeSession } from '../../../../../../src/ask/api';
import { askDeps } from '../../../../../../src/ask/api-live';

// POST /api/ask/sessions/:id/close → {id, status: "closed"}: closes the session (src/ask/api.ts).
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return closeSession(request, (await params).id, askDeps());
}
