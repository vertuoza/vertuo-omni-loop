import { listPrds } from '../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../src/public-api/public-api.live';

// GET /api/v1/prds?limit=&cursor= → 200 {data, next_cursor}: the workspace's PRDs, newest first, for a
// program with its API key (src/public-api/public-api.controller.ts, PRD 2022 s2).
export const maxDuration = 30;

export function GET(request: Request) {
  return listPrds(request, publicApiDeps());
}
