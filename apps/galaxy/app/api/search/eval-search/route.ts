import { evalSearchRoute } from '../../../../src/search-eval/eval-search-route';
import { evalSearchDeps } from '../../../../src/search-eval/live';

// POST /api/search/eval-search {workspaceId, productId, question} → 200 {ids, mode}: omni-app's
// `search-eval-run` job searches the product's knowledge as an agent would (top 10), signed with an HMAC over
// the body under SEARCH_CATEGORIZE_SECRET, and nothing is logged in mcp_search_log (src/search-eval/
// eval-search-route.ts, PRD omni-loop-8 s3).
export const maxDuration = 60;

export async function POST(request: Request) {
  return evalSearchRoute(request, evalSearchDeps());
}
