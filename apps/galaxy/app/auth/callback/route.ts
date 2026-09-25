import { NextResponse, type NextRequest } from 'next/server';
import { cliSignInReturn } from '../../../src/ask/cli-code';
import { cliCallbackDeps } from '../../../src/ask/cli-code-live';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';

// Where Google (sign-in) and GitHub (linking) send the player back. The code becomes a session
// cookie; after a GitHub link, link_github() copies the linked login onto the player, from the
// identity Supabase recorded, never from anything the browser sends. Then back to the arcade, with
// the outcome in the query string for it to show.
// With `?next=ask-cli` it is `omni signin` coming back instead: the code becomes a sign-in for the
// terminal, not a cookie, and the browser goes on to the terminal's loopback address with a one-time
// code, or back to /ask/signin with the reason (src/ask/cli-code.ts).
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
    const response = NextResponse.redirect(await cliSignInReturn(request.nextUrl, origin(request), deps));
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

  if (params.get('next') === 'link') {
    const { data, error: linkError } = await db.rpc('link_github');
    if (linkError) return back('link_error', linkError.message);
    return back('linked', (data as { github_login?: string } | null)?.github_login ?? '');
  }
  return back('signin', 'ok');
}
