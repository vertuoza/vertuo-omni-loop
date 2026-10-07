import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { openedExchange } from '../../../src/data/sign-in-exchange';
import { historySignInReturn } from '../../../src/dossier/page/sign-in';
import { ROADMAPS_PATH } from '../../../src/roadmap/page/model';

// Where GitHub sends the person back after signing in on /roadmaps (PRD 1162): the code becomes the
// session cookie, the account joins the workspaces of its GitHub orgs and links GitHub
// (src/data/sign-in.ts), then back to /roadmaps, as /bugs' callback does.

export async function GET(request: NextRequest) {
  return NextResponse.redirect(await historySignInReturn(request.nextUrl, requestOrigin(request), await openedExchange(), null, ROADMAPS_PATH));
}
