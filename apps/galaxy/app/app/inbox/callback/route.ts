import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin, signInBackTo } from '../../../../src/ask/page/sign-in';
import { settlingExchange } from '../../../../src/data/sign-in';
import { signInDeps } from '../../../../src/data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';

// Where GitHub sends the person back after signing in on the Inbox (PRD omni-loop-22, s5), as /app's own
// callback does: the code becomes the session cookie, the account joins the workspaces of its GitHub orgs
// and links GitHub (src/data/sign-in.ts), then back to /app/inbox, or with `?signin_error=` saying why not.

export async function GET(request: NextRequest) {
  const back = new URL('/app/inbox', requestOrigin(request));
  if (!supabaseEnv()) return NextResponse.redirect(await signInBackTo(request.nextUrl, back, null, 'inbox'));
  const db = await supabaseServer();
  return NextResponse.redirect(await signInBackTo(
    request.nextUrl, back,
    settlingExchange((code) => db.auth.exchangeCodeForSession(code), db, signInDeps),
    'inbox',
  ));
}
