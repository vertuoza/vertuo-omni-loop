import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { settlingExchange, type SessionExchange } from '../../../src/data/sign-in';
import { signInDeps } from '../../../src/data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { dashboardSignInReturn } from '../../../src/dashboard/sign-in';

// Where GitHub sends the person back after signing in on the dashboard: the code becomes the session
// cookie, the account joins the workspaces of its GitHub orgs and links GitHub (src/data/sign-in.ts),
// then back to /app, or to /app?signin_error=… with the reason (src/dashboard/sign-in.ts).

export async function GET(request: NextRequest) {
  if (!supabaseEnv()) return NextResponse.redirect(await dashboardSignInReturn(request.nextUrl, requestOrigin(request), null, null));
  const db = await supabaseServer();
  return NextResponse.redirect(await dashboardSignInReturn(
    request.nextUrl, requestOrigin(request),
    settlingExchange((code) => db.auth.exchangeCodeForSession(code) as ReturnType<SessionExchange>, db, signInDeps),
    null,
  ));
}
