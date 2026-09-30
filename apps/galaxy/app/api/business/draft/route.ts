import { draftRoute } from '../../../../src/business/draft/api';
import { draftRouteDeps } from '../../../../src/business/draft/live';

// POST /api/business/draft {workspace} → 202 {draft} a draft started and run after the answer, or 200
// {draft, running: true} the one already running: Settings › Business › Draft from my repos
// (src/business/draft/api.ts, PRD 774 s2). The run reads the workspace's repositories and web pages
// after the answer, so it may take up to maxDuration.
export const maxDuration = 300;

export function POST(request: Request) {
  return draftRoute(request, draftRouteDeps());
}
