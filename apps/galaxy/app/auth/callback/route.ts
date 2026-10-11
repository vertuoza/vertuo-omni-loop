import { NextResponse, type NextRequest } from 'next/server';
import { cliSignInReturn, type CliSession } from '../../../src/ask/cli-code';
import { cliCallbackDeps } from '../../../src/ask/cli-code-live';
import { madeCookie, tokenSignInReturn } from '../../../src/ask/kit-token';
import { kitMakeDeps } from '../../../src/ask/kit-token-live';
import { sessionOf } from '../../../src/data/session';
import { afterSignIn, appLanding, joinBeforeIssue, settleSignIn } from '../../../src/data/sign-in';
import { signInDeps } from '../../../src/data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { landingAfterSignIn } from '../../../src/data/workspace';
import { voterReturn } from '../../../src/ideas/vote/callback';
import { addVote } from '../../../src/ideas/vote/store';
import { VOTER_NEXT } from '../../../src/ideas/vote/vote';

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
// With `?next=ask-cli&purpose=token` it is a kit token being made (PRD 1628): `omni setup-token`, or
// Make a token on a profile page. The same fresh sign-in, joined and linked, becomes the token's stored
// session, and the token goes back once: to the terminal's loopback address, or to the page, kept for
// it in a cookie only POST /api/ask/token/made reads (src/ask/kit-token.ts).
// With `?next=ideas` it is a voter on a public ideas board (PRD 1246): their sign-in asked no
// `read:org`, the vote they pressed is counted as them, and they land back on that board, allowlisted,
// never on /signup and joining nothing (src/ideas/vote/callback.ts).
// The arcade's own address, as the browser sees it (behind Vercel's proxy too): the session cookie
// is bound to that host, so the player must come back to exactly it.
function origin(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/** `omni signin` coming back: on to the terminal's loopback address with a one-time code, or back to
 * /ask/signin with the reason, the PKCE verifier spent. */
async function cliReturn(request: NextRequest) {
  const { deps, spent } = cliCallbackDeps(request.cookies.getAll());
  const joining = joinBeforeIssue(deps, (session) => settleSignIn(supabaseAs(session.access_token), session, signInDeps));
  const response = NextResponse.redirect(await cliSignInReturn(request.nextUrl, origin(request), joining));
  for (const { name, value, options } of spent) response.cookies.set(name, value, options);
  return response;
}

/** A kit token's round trip coming back: on to the loopback or the page, the made token kept for the
 * page in its cookie, and the PKCE verifier spent. */
async function kitTokenReturn(request: NextRequest) {
  const join = (session: CliSession) => settleSignIn(supabaseAs(session.access_token), session, signInDeps);
  const { deps, spent } = kitMakeDeps(request.cookies.getAll(), join);
  const { location, made } = await tokenSignInReturn(request.nextUrl, origin(request), deps);
  const response = NextResponse.redirect(location);
  for (const { name, value, options } of spent) response.cookies.set(name, value, options);
  if (made) {
    const cookie = madeCookie(made, new URL(location).protocol === 'https:');
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get('next') === 'ask-cli') return params.get('purpose') === 'token' ? kitTokenReturn(request) : cliReturn(request);
  if (params.get('next') === VOTER_NEXT) {
    const ports = supabaseEnv()
      ? await supabaseServer().then((db) => ({
          exchange: async (code: string) => ({ error: (await db.auth.exchangeCodeForSession(code)).error?.message ?? null }),
          vote: (ideaId: string) => addVote(db, ideaId),
        }))
      : null;
    return NextResponse.redirect(new URL(await voterReturn(params, ports), origin(request)));
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
