import { addSourceRoute, removeSourceRoute } from '../../../../src/business/draft/api';
import { sourcesRouteDeps } from '../../../../src/business/draft/live';

// POST /api/business/sources {workspace, url} → 201 {source}: + add a web page, https and public only,
// three at most. DELETE /api/business/sources {workspace, source} → 200 {removed}
// (src/business/draft/api.ts, PRD 774 s2).
export function POST(request: Request) {
  return addSourceRoute(request, sourcesRouteDeps());
}

export function DELETE(request: Request) {
  return removeSourceRoute(request, sourcesRouteDeps());
}
