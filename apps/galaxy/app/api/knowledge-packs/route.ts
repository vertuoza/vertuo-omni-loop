import { knowledgePacksDeps } from '../../../src/knowledge-packs/knowledge-packs-live';
import { readKnowledgePack } from '../../../src/knowledge-packs/knowledge-packs.controller';

// GET /api/knowledge-packs?repo=<owner/name>[&sha=<commit>] → 200 {repository, sha, committedAt, madeAt,
// files}: the newest knowledge pack of a repository the caller's workspaces hold, or the pack of that
// commit, for the kit's `omni kb pack get` (src/knowledge-packs/knowledge-packs.controller.ts, PRD 2011).
export const maxDuration = 60;

export function GET(request: Request) {
  return readKnowledgePack(request, knowledgePacksDeps());
}
