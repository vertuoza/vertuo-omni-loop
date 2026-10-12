import { exchangeToken } from '../../../../src/ask/cli-code';
import { tokenDeps } from '../../../../src/ask/cli-code-live';
import { kitExchangeLive } from '../../../../src/ask/kit-token-live';

// POST /api/ask/token {code, repo?}, {refresh_token} or {omni_token, repo?} → {access_token,
// refresh_token, expires_at, login, workspace, reason?, email?}: the terminal's sign-in, traded or
// renewed, and where the repository it names goes (src/ask/cli-code.ts); for a kit token, a short
// session of its maker's with refresh_token null, or 401 with the reason it does not work
// (src/ask/kit-token.ts, PRD 1628).
export const maxDuration = 60;

export function POST(request: Request) {
  return exchangeToken(request, { ...tokenDeps(), kit: kitExchangeLive() });
}
