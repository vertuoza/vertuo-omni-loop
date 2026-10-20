import { knowledgeChangesDeps } from '../../../../src/knowledge-api/knowledge-api-live';
import { postKnowledgeChange } from '../../../../src/knowledge-api/knowledge-api.controller';

// POST /api/knowledge/changes {repo, product?, kind, action, entry?, fields} → 200 {done, id, url, waitsFor}:
// the kit's `omni kb legal|glossary add|edit` and `omni constituents add|edit` add or edit one item of the
// repository's product's knowledge, as the signed-in person (src/knowledge-api/knowledge-api.controller.ts,
// PRD 2268).
export const maxDuration = 30;

export function POST(request: Request) {
  return postKnowledgeChange(request, knowledgeChangesDeps());
}
