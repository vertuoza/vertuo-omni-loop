import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../../../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../../../../../src/data/supabase-server';
import { joinByDomain } from '../../../../../../../src/data/workspace';
import { readShort } from '../../../../../../../src/dossier/page/short';
import { shortSignInReturn } from '../../../../../../../src/dossier/page/sign-in';

// Where Google sends the person back after signing in on the short address of a PRD's questions: the
// code becomes the session cookie, the account joins the workspaces of its email's domain, then back
// to the same short address (src/dossier/page/sign-in.ts), which redirects to the Outbox tab.

type Params = { params: Promise<{ owner: string; repo: string; n: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const key = readShort(await params);
  if (!supabaseEnv()) return NextResponse.redirect(await shortSignInReturn(request.nextUrl, requestOrigin(request), key, null, null));
  const db = await supabaseServer();
  return NextResponse.redirect(await shortSignInReturn(
    request.nextUrl, requestOrigin(request), key,
    (code) => db.auth.exchangeCodeForSession(code),
    () => joinByDomain(db),
  ));
}
