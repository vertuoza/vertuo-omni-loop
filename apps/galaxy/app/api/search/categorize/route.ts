import { searchCategorizeDeps } from '../../../../src/search-categorize/live';
import { searchCategorizeRoute } from '../../../../src/search-categorize/route';

// POST /api/search/categorize {workspaceId, productId, question} → 200 {category, decidedBy, confidence}:
// omni-app's `search-categorize` job asks the workspace's `search-category` Jev decision, signed with an
// HMAC over the body under SEARCH_CATEGORIZE_SECRET (src/search-categorize/route.ts, PRD omni-loop-7 s2).
export const maxDuration = 60;

export async function POST(request: Request) {
  return searchCategorizeRoute(request, searchCategorizeDeps());
}
