import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { githubSignIn } from '../../../src/data/sign-in-github';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { readSetup, setupQuery, setupReturn } from '../../../src/signup/installed';

// The App's setup URL (apps/omni-app/app.yml, PRD 359): GitHub sends the visitor here after they
// install Omni Loop (?installation_id=…&setup_action=install) or ask their org's owner to
// (?setup_action=request). The address alone proves nothing, so the visitor signs in with GitHub again
// (silent: they already granted the scopes), and the callback, holding a fresh provider token, checks
// the installation against who they are and finishes (src/signup/installed.ts).

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const setup = readSetup(request.nextUrl.searchParams);
  if (!setup) return NextResponse.redirect(setupReturn({ kind: 'error', reason: 'link' }, origin));
  if (!supabaseEnv()) return NextResponse.redirect(setupReturn({ kind: 'error', reason: 'closed' }, origin));

  const back = new URL('/signup/installed/callback', origin);
  back.search = setupQuery(setup).toString();
  const db = await supabaseServer();
  const { data, error } = await db.auth.signInWithOAuth(githubSignIn(back.toString(), { fromServer: true }));
  if (error || !data.url) {
    console.error(`sign-up: GitHub sign-in could not start (${error?.message ?? 'no address'})`);
    return NextResponse.redirect(setupReturn({ kind: 'error', reason: 'github' }, origin));
  }
  return NextResponse.redirect(data.url);
}
