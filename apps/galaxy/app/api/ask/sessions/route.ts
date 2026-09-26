import { openSession } from '../../../../src/ask/api';
import { askDeps } from '../../../../src/ask/api-live';

// POST /api/ask/sessions {title} → {id, url}: opens an ask session (src/ask/api.ts).
export const maxDuration = 60;

export function POST(request: Request) {
  return openSession(request, askDeps());
}
