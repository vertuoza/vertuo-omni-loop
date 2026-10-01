import { removeKeyRoute, saveKeyRoute } from '../../../../src/jev/settings/api';
import { keyRouteDeps } from '../../../../src/jev/settings/live';

// POST /api/jev/key {workspace, key} → 200 {key}: the workspace's TypeSafe key, tested with one call to
// Jev, sealed and stored; DELETE /api/jev/key {workspace} → 200 {key}: removed, every decision Off.
// Settings › Jev's owner-only calls (src/jev/settings/api.ts, PRD 812 s1).

export function POST(request: Request) {
  return saveKeyRoute(request, keyRouteDeps());
}

export function DELETE(request: Request) {
  return removeKeyRoute(request, keyRouteDeps());
}
