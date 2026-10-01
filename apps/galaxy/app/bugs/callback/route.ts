import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { settlingExchange } from '../../../src/data/sign-in';
import { signInDeps } from '../../../src/data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { historySignInReturn } from '../../../src/dossier/page/sign-in';
import { WORK_PATHS } from '../../../src/dossier/page/work';

// Where GitHub sends the person back after signing in on /bugs: the code becomes the session
// cookie, the account joins the workspaces of its GitHub orgs and links GitHub (src/data/sign-in.ts),
// then back to /bugs (PRD 627; src/dossier/page/sign-in.ts).

export async function GET(request: NextRequest) {
  if (!supabaseEnv()) return NextResponse.redirect(await historySignInReturn(request.nextUrl, requestOrigin(request), null, null, WORK_PATHS.bug));
  const db = await supabaseServer();
  const exchange = (code: string) => db.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(await historySignInReturn(
    request.nextUrl, requestOrigin(request), settlingExchange(exchange, db, signInDeps), null, WORK_PATHS.bug,
  ));
}
