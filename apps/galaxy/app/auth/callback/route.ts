import { NextResponse, type NextRequest } from 'next/server';
import { cliSignInReturn } from '../../../src/ask/cli-code';
import { cliCallbackDeps } from '../../../src/ask/cli-code-live';
import { afterSignIn, joinBeforeIssue } from '../../../src/data/sign-in';
import { supabaseAs, supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { joinByDomain } from '../../../src/data/workspace';

// Where Google (sign-in) and GitHub (linking) send the player back. The code becomes a session
// cookie, and every sign-in joins the workspaces of the account's confirmed email domain
// (join_by_domain()). After a GitHub link, link_github() then copies the linked login onto the
// player, from the identity Supabase recorded, never from anything the browser sends. Then back to
// the arcade, with the outcome in the query string for it to show (src/data/sign-in.ts).
// With `?next=ask-cli` it is `omni signin` coming back instead: the code becomes a sign-in for the
// terminal, not a cookie, which joins as well before its one-time code is issued, and the browser
// goes on to the terminal's loopback address with that code, or back to /ask/signin with the reason
// (src/ask/cli-code.ts).
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
    const joining = joinBeforeIssue(deps, (session) => joinByDomain(supabaseAs(session.access_token)));
    const response = NextResponse.redirect(await cliSignInReturn(request.nextUrl, origin(request), joining));
    for (const { name, value, options } of spent) response.cookies.set(name, value, options);
    return response;
  }
  const home = new URL('/', origin(request));
  const back = (key: string, value: string) => { home.searchParams.set(key, value); return NextResponse.redirect(home); };

  const failure = params.get('error_description') ?? params.get('error');
  if (failure) return back('signin_error', failure);
  const code = params.get('code');
  if (!code || !supabaseEnv()) return NextResponse.redirect(home);

  const db = await supabaseServer();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(`auth callback: ${error.message}`);
    return back('signin_error', 'That sign-in could not be finished. Start again from this browser.');
  }

  const [key, value] = await afterSignIn(db, params.get('next'));
  return back(key, value);
}
