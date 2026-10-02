import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { codeExchange } from '../../../src/data/sign-in-exchange';
import { knowledgeSignInReturn } from '../../../src/knowledge/sign-in';

// Where GitHub sends the person back after signing in on the knowledge map: the code becomes the
// session cookie, the account joins the workspaces of its GitHub orgs and links GitHub
// (src/data/sign-in.ts), then back to /knowledge on the entry the address named
// (src/knowledge/sign-in.ts).

export async function GET(request: NextRequest) {
  return NextResponse.redirect(await knowledgeSignInReturn(request.nextUrl, requestOrigin(request), codeExchange()));
}
