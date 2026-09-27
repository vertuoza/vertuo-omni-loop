import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';
import { joinByDomain } from '../../../../src/data/workspace';
import { dossierSignInReturn } from '../../../../src/dossier/page/sign-in';

// Where Google sends the person back after signing in on a dossier: the code becomes the session
// cookie, the account joins the workspaces of its email's domain, then back to the same dossier
// (src/dossier/page/sign-in.ts).

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseEnv()) return NextResponse.redirect(await dossierSignInReturn(request.nextUrl, requestOrigin(request), id, null, null));
  const db = await supabaseServer();
  return NextResponse.redirect(await dossierSignInReturn(
    request.nextUrl, requestOrigin(request), id,
    (code) => db.auth.exchangeCodeForSession(code),
    () => joinByDomain(db),
  ));
}
