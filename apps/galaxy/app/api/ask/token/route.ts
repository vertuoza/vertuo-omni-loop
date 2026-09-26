import { exchangeToken } from '../../../../src/ask/cli-code';
import { tokenDeps } from '../../../../src/ask/cli-code-live';

// POST /api/ask/token {code} or {refresh_token} → {access_token, refresh_token, expires_at, email}:
// the terminal's sign-in, traded or renewed (src/ask/cli-code.ts).
export const maxDuration = 60;

export function POST(request: Request) {
  return exchangeToken(request, tokenDeps());
}
