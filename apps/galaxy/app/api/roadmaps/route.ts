import { roadmapPush } from '../../../src/roadmap/api';
import { roadmapDeps } from '../../../src/roadmap/api-live';

// POST /api/roadmaps {repo, roadmap, title, milestone, …, document, prds} → 201 or 200 {roadmapId,
// created, product, unknownProduct, note}: the kit's `omni roadmap push` tells the app where a roadmap
// stands (src/roadmap/api.ts, PRD 1162).
export const maxDuration = 10;

export function POST(request: Request) {
  return roadmapPush(request, roadmapDeps());
}
