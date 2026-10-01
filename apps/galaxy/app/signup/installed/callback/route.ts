import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../../src/ask/page/sign-in';
import type { SignedIn } from '../../../../src/data/sign-in';
import { signInDeps } from '../../../../src/data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';
import { finishSetup, readSetup, setupReturn } from '../../../../src/signup/installed';

// Where GitHub sends the visitor back from /signup/installed's sign-in (PRD 359): the code becomes the
// session cookie, then finishSetup() checks the installation against who they are on GitHub and makes
// the workspace, or records their sign-up request. On to /play, or to /signup's screen.

export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;
  const setup = readSetup(params);
  if (!setup) return NextResponse.redirect(setupReturn({ kind: 'error', reason: 'link' }, origin));
  if (!supabaseEnv()) return NextResponse.redirect(setupReturn({ kind: 'error', reason: 'closed' }, origin));

  const code = params.get('code');
  const failure = params.get('error_description') ?? params.get('error');
  if (failure || !code) {
    if (failure) console.error(`sign-up: GitHub sign-in refused (${failure})`);
    return NextResponse.redirect(setupReturn({ kind: 'error', reason: 'github' }, origin));
  }

  const db = await supabaseServer();
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  const session = (data?.session as SignedIn | null | undefined) ?? null; // ts-allow: a session Supabase issued carries what SignedIn names
  if (error || !session) {
    console.error(`sign-up: the sign-in could not be finished (${error?.message ?? 'no session'})`);
    return NextResponse.redirect(setupReturn({ kind: 'error', reason: 'github' }, origin));
  }
  return NextResponse.redirect(setupReturn(await finishSetup(db, session, setup, signInDeps), origin));
}
