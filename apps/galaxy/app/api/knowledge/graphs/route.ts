import { graphPushDeps } from '../../../../src/knowledge-graph/push-live';
import { pushKnowledgeGraph } from '../../../../src/knowledge-graph/push.controller';

// POST /api/knowledge/graphs {repo, commit, graph} → 200 {repo, commit, nodes, edges, products}: the kit's
// `omni kb graph push` keeps a repository's knowledge graph at its commit, for the product pages and the
// read route (src/knowledge-graph/push.controller.ts, PRD 1798).
export const maxDuration = 30;

export function POST(request: Request) {
  return pushKnowledgeGraph(request, graphPushDeps());
}
