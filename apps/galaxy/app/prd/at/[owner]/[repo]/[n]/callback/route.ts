import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../../../../../src/ask/page/sign-in';
import { settlingExchange, type SessionExchange } from '../../../../../../../src/data/sign-in';
import { signInDeps } from '../../../../../../../src/data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../../../../../../src/data/supabase-server';
import { atSignInReturn, readAt } from '../../../../../../../src/dossier/page/history-at';

// Where GitHub sends the person back after signing in on the short address of a PRD's questions (PRD
// 251, s10): the code becomes the session cookie, the account joins the workspaces of its GitHub orgs
// and links GitHub (src/data/sign-in.ts), then back to the same short address, which redirects to the
// Outbox tab (src/dossier/page/history-at.ts).

type Params = { params: Promise<{ owner: string; repo: string; n: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const key = readAt(await params);
  if (!supabaseEnv()) return NextResponse.redirect(await atSignInReturn(request.nextUrl, requestOrigin(request), key, null, null));
  const db = await supabaseServer();
  const exchange = (code: string) => db.auth.exchangeCodeForSession(code) as ReturnType<SessionExchange>;
  return NextResponse.redirect(await atSignInReturn(
    request.nextUrl, requestOrigin(request), key, settlingExchange(exchange, db, signInDeps), null,
  ));
}
