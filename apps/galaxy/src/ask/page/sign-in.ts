// Signing in from an ask page, and coming back to it. The sign-in is the galaxy's Google sign-in
// (Supabase Auth, restricted to @vertuoza.com); only the way back differs from the arcade's: Google
// returns to /ask/<id>/callback, which turns the code into the session cookie and goes back to the
// same session, carrying the reason when the sign-in was refused.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Session ids are uuids; anything else is not a session anyone has. */
export const isSessionId = (id: string) => UUID.test(id);

/** Where Google sends the person back after signing in on a session's page. */
export const callbackPath = (sessionId: string) => `/ask/${encodeURIComponent(sessionId)}/callback`;

/** The site's address as the browser sees it, behind Vercel's proxy too: the session cookie is
 * bound to that host, so the person must come back to exactly it. */
export function requestOrigin(request: { url: string; headers: Headers }): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return host ? `${proto}://${host}` : url.origin;
}

/** Turns a sign-in code into the session cookie (Supabase's exchangeCodeForSession). */
export type Exchange = (code: string) => Promise<{ error: { message: string } | null }>;

/** Where the callback sends the person: back to the session, with `signin_error` when the sign-in
 * failed. Anything that is not a session id goes home, on this site. `exchange` is null when this
 * deployment has no database. */
export async function signInReturn(url: URL, origin: string, sessionId: string, exchange: Exchange | null): Promise<string> {
  const back = new URL(isSessionId(sessionId) ? `/ask/${sessionId}` : '/', origin);
  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (refused) {
    back.searchParams.set('signin_error', refused);
  } else if (code && exchange) {
    const { error } = await exchange(code);
    if (error) {
      console.error(`ask sign-in: ${error.message}`);
      back.searchParams.set('signin_error', 'That sign-in could not be finished. Start again from this browser.');
    }
  }
  return back.toString();
}
