import { shareRound } from '../../../../../../src/ask/api';
import { askDeps } from '../../../../../../src/ask/api-live';

// POST /api/ask/rounds/:id/shares {member} → {roundId, sharedWith, url}: the session's owner shares a
// round with another member of its workspace, who may then answer it while it is open (src/ask/api.ts).
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return shareRound(request, (await params).id, askDeps());
}
