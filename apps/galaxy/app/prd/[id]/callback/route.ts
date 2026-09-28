import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../../src/ask/page/sign-in';
import { settlingExchange, type SessionExchange } from '../../../../src/data/sign-in';
import { signInDeps } from '../../../../src/data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';
import { dossierSignInReturn } from '../../../../src/dossier/page/sign-in';

// Where GitHub sends the person back after signing in on a dossier: the code becomes the session
// cookie, the account joins the workspaces of its GitHub orgs and links GitHub (src/data/sign-in.ts),
// then back to the same dossier (src/dossier/page/sign-in.ts).

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseEnv()) return NextResponse.redirect(await dossierSignInReturn(request.nextUrl, requestOrigin(request), id, null, null));
  const db = await supabaseServer();
  const exchange = (code: string) => db.auth.exchangeCodeForSession(code) as ReturnType<SessionExchange>;
  return NextResponse.redirect(await dossierSignInReturn(
    request.nextUrl, requestOrigin(request), id, settlingExchange(exchange, db, signInDeps), null,
  ));
}
