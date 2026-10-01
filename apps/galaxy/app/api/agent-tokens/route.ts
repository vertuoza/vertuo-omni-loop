import { makeTokenRoute, revokeTokenRoute } from '../../../src/agent-connect/tokens/api';
import { tokenRouteDeps } from '../../../src/agent-connect/tokens/live';

// POST /api/agent-tokens {workspace, name} → 201 {token, url, listed}: a new read-only link for an
// agent, its token shown this once. DELETE /api/agent-tokens {workspace, token} → 200 {revoked}.
// Settings › Business's Connect an agent card (src/agent-connect/tokens/api.ts, PRD 855 s1).

export function POST(request: Request) {
  return makeTokenRoute(request, tokenRouteDeps());
}

export function DELETE(request: Request) {
  return revokeTokenRoute(request, tokenRouteDeps());
}
