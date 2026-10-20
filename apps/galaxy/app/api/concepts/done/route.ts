import { markDone } from '../../../../src/concepts/done';
import { doneDeps } from '../../../../src/concepts/done.live';

// POST /api/concepts/done {concept, done} → 200 {concept, issue}: a member of the concept's workspace marks
// it done (its issue closed as completed) or reopens it, as the omni-loop App, with a comment naming them
// (src/concepts/done.ts, PRD 2213). Signed out is 401, not a member 403, a GitHub failure 502.
export const maxDuration = 60;

export function POST(request: Request) {
  return markDone(request, doneDeps());
}
