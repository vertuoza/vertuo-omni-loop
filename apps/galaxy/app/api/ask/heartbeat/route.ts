import { heartbeat } from '../../../../src/working/api';
import { workingDeps } from '../../../../src/working/api-live';

// POST /api/ask/heartbeat {claudeSessionId, repo, work, ended?} → 204: a terminal says it is working
// (src/working/api.ts, PRD 757).
export const maxDuration = 10;

export function POST(request: Request) {
  return heartbeat(request, workingDeps());
}
