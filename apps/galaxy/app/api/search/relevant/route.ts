import { searchRelevantRoute } from '../../../../src/search-eval/relevant-route';
import { searchRelevantDeps } from '../../../../src/search-eval/live';

// POST /api/search/relevant {workspaceId, productId, question, entryIds} → 200 {verdicts: [{entryId, relevant,
// confidence}]}: omni-app's `search-eval-promote` job asks the workspace's `search-relevant` Jev decision
// whether each entry answers the question, signed with an HMAC over the body under SEARCH_CATEGORIZE_SECRET
// (src/search-eval/relevant-route.ts, PRD omni-loop-8 s3).
export const maxDuration = 60;

export async function POST(request: Request) {
  return searchRelevantRoute(request, searchRelevantDeps());
}
