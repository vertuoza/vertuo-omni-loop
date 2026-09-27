import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { joinByDomain } from '../../../src/data/workspace';
import { historySignInReturn } from '../../../src/dossier/page/sign-in';

// Where Google sends the person back after signing in on the history: the code becomes the session
// cookie, the account joins the workspaces of its email's domain, then back to /prd
// (src/dossier/page/sign-in.ts).

export async function GET(request: NextRequest) {
  if (!supabaseEnv()) return NextResponse.redirect(await historySignInReturn(request.nextUrl, requestOrigin(request), null, null));
  const db = await supabaseServer();
  return NextResponse.redirect(await historySignInReturn(
    request.nextUrl, requestOrigin(request),
    (code) => db.auth.exchangeCodeForSession(code),
    () => joinByDomain(db),
  ));
}
