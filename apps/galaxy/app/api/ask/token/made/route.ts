import { NextResponse, type NextRequest } from 'next/server';
import { MADE_COOKIE, madeCookiePath, takeMadeToken } from '../../../../../src/ask/kit-token';

// POST /api/ask/token/made → {token, name, expires_at}, once, or 404: the kit token Make a token just
// made, kept for this browser by the auth callback in a cookie no script reads (src/ask/kit-token.ts,
// PRD 1628). The cookie is cleared with the answer, so a reload never shows the token again.
export function POST(request: NextRequest) {
  const answer = takeMadeToken(request.cookies.get(MADE_COOKIE)?.value);
  const response = new NextResponse(answer.body, { status: answer.status, headers: answer.headers });
  response.cookies.set(MADE_COOKIE, '', { path: madeCookiePath, maxAge: 0, httpOnly: true, sameSite: 'lax' });
  return response;
}
