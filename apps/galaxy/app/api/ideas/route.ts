import { addIdea, listIdeas } from '../../../src/ideas/api/api';
import { ideasApiDeps } from '../../../src/ideas/api/api-live';

// POST /api/ideas {repo, title, pitch, lane?} → 201 {id, url}: a member adds an idea (src/ideas/api/api.ts, PRD 1246).
// GET /api/ideas?repo=<owner/name> → 200 {repo, url, ideas}: a member lists the board lane by lane.
export const maxDuration = 10;

export function POST(request: Request) {
  return addIdea(request, ideasApiDeps());
}

export function GET(request: Request) {
  return listIdeas(request, ideasApiDeps());
}
