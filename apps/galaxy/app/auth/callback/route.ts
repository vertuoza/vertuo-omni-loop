import { NextResponse, type NextRequest } from 'next/server';
import { cliSignInReturn } from '../../../src/ask/cli-code';
import { cliCallbackDeps } from '../../../src/ask/cli-code-live';
import { afterSignIn, appLanding, joinBeforeIssue, sessionOf, settleSignIn } from '../../../src/data/sign-in';
import { signInDeps } from '../../../src/data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { landingAfterSignIn } from '../../../src/data/workspace';

// Where GitHub sends the player back (PRD 359). The code becomes a session cookie, and every
// sign-in joins the workspaces of the person's GitHub orgs, then runs link_github(), which copies
// the GitHub login onto the player from the identity Supabase recorded, never from anything the
// browser sends (src/data/sign-in.ts). Then back to the arcade at /play (HOME is at /, PRD 261),
// with the outcome in the query string for it to show; or, for someone still in no workspace, on to
// /signup to install Omni Loop.
// With `?next=app`, the Omni app was picked at SELECT YOUR APP on HOME (PRD 932): a finished sign-in
// lands on /app instead of the arcade, through the allowlist appLanding(). A failure still goes back
// to the arcade with its reason, and someone in no workspace still goes on to /signup.
// With `?next=ask-cli` it is `omni signin` coming back instead: the code becomes a sign-in for the
// terminal, not a cookie, which joins and links as well before its one-time code is issued, and the
// browser goes on to the terminal's loopback address with that code, or back to /ask/signin with the
// reason (src/ask/cli-code.ts).
// The arcade's own address, as the browser sees it (behind Vercel's proxy too): the session cookie
// is bound to that host, so the player must come back to exactly it.
function origin(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get('next') === 'ask-cli') {
    const { deps, spent } = cliCallbackDeps(request.cookies.getAll());
    const joining = joinBeforeIssue(deps, (session) => settleSignIn(supabaseAs(session.access_token), session, signInDeps));
    const response = NextResponse.redirect(await cliSignInReturn(request.nextUrl, origin(request), joining));
    for (const { name, value, options } of spent) response.cookies.set(name, value, options);
    return response;
  }
  const home = new URL('/play', origin(request));
  const back = (key: string, value: string) => { home.searchParams.set(key, value); return NextResponse.redirect(home); };

  const failure = params.get('error_description') ?? params.get('error');
  if (failure) return back('signin_error', failure);
  const code = params.get('code');
  if (!code || !supabaseEnv()) return NextResponse.redirect(home);

  const db = await supabaseServer();
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(`auth callback: ${error.message}`);
    return back('signin_error', 'That sign-in could not be finished. Start again from this browser.');
  }

  // The answer parsed: one with no body, or a session that does not parse, reads as no session.
  const session = sessionOf(data, 'auth callback: exchangeCodeForSession');
  const next = params.get('next');
  const [key, value] = await afterSignIn(db, session, signInDeps, next);
  // Someone still in no workspace goes straight on to sign-up, not to the arcade's dead end.
  if (session && key === 'signin' && (await landingAfterSignIn(db, session.user.id)) === '/signup') {
    return NextResponse.redirect(new URL('/signup', origin(request)));
  }
  // The Omni app's pick lands on the board; the outcome in the query string is the arcade's to read.
  if (appLanding(next) === '/app') return NextResponse.redirect(new URL('/app', origin(request)));
  return back(key, value);
}
