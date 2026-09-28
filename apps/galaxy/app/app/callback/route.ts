import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { joinByDomain } from '../../../src/data/workspace';
import { dashboardSignInReturn } from '../../../src/dashboard/sign-in';

// Where Google sends the person back after signing in on the dashboard: the code becomes the session
// cookie, the account joins the workspaces of its email's domain, then back to /app, or to
// /app?signin_error=… with the reason (src/dashboard/sign-in.ts).

export async function GET(request: NextRequest) {
  if (!supabaseEnv()) return NextResponse.redirect(await dashboardSignInReturn(request.nextUrl, requestOrigin(request), null, null));
  const db = await supabaseServer();
  return NextResponse.redirect(await dashboardSignInReturn(
    request.nextUrl, requestOrigin(request),
    (code) => db.auth.exchangeCodeForSession(code),
    () => joinByDomain(db),
  ));
}
