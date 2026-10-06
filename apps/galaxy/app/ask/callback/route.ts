import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin, signInReturn } from '../../../src/ask/page/sign-in';
import { codeExchange } from '../../../src/data/sign-in-exchange';

// Where GitHub sends the person back after signing in on their page, /ask: the code becomes the
// session cookie, the account joins the workspaces of its GitHub orgs and links GitHub
// (src/data/sign-in.ts), then back to /ask (src/ask/page/sign-in.ts).

export async function GET(request: NextRequest) {
  return NextResponse.redirect(await signInReturn(request.nextUrl, requestOrigin(request), null, codeExchange()));
}
