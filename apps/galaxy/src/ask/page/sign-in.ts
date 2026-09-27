// Signing in from an ask page, and coming back to it. The sign-in is the galaxy's Google sign-in
// (Supabase Auth, restricted to @vertuoza.com); only the way back differs from the arcade's: Google
// returns to /ask/<id>/callback (or /ask/callback from the person's page, /ask), which turns the code
// into the session cookie and goes back to the same page, carrying the reason when the sign-in was
// refused. A shared question (/ask/q/<round>), For me (/ask/for-me) and the history (/ask/history)
// come back the same way, each through its own callback (PRD 144).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Session ids are uuids; anything else is not a session anyone has. */
export const isSessionId = (id: string) => UUID.test(id);

/** Where Google sends the person back after signing in on a session's page, or on /ask (null). */
export const callbackPath = (sessionId: string | null) =>
  sessionId === null ? '/ask/callback' : `/ask/${encodeURIComponent(sessionId)}/callback`;

/** Where Google sends the person back after signing in on a shared question's page. */
export const questionCallbackPath = (roundId: string) => `/ask/q/${encodeURIComponent(roundId)}/callback`;

/** Where Google sends the person back after signing in on For me. */
export const FOR_ME_CALLBACK = '/ask/for-me/callback';

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

/** Where the callback sends the person: back to the session (or to /ask, for null), with
 * `signin_error` when the sign-in failed. Anything that is not a session id goes home, on this
 * site. `exchange` is null when this deployment has no database. */
export async function signInReturn(url: URL, origin: string, sessionId: string | null, exchange: Exchange | null): Promise<string> {
  return signInBack(url, origin, sessionId === null ? '/ask' : isSessionId(sessionId) ? `/ask/${sessionId}` : '/', exchange);
}

/** The same, for a shared question: back to /ask/q/<round>, or home for anything that is not a round id. */
export async function questionSignInReturn(url: URL, origin: string, roundId: string, exchange: Exchange | null): Promise<string> {
  return signInBack(url, origin, isSessionId(roundId) ? `/ask/q/${roundId}` : '/', exchange);
}

/** The same, for For me. */
export async function forMeSignInReturn(url: URL, origin: string, exchange: Exchange | null): Promise<string> {
  return signInBack(url, origin, '/ask/for-me', exchange);
}

/** Where Google sends the person back after signing in on the history. */
export const HISTORY_CALLBACK = '/ask/history/callback';

/** The same, for the history. */
export async function historySignInReturn(url: URL, origin: string, exchange: Exchange | null): Promise<string> {
  return signInBack(url, origin, '/ask/history', exchange);
}

/** Back to `path` on this site, once the code is exchanged, or with `signin_error` saying why not. */
async function signInBack(url: URL, origin: string, path: string, exchange: Exchange | null): Promise<string> {
  const back = new URL(path, origin);
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
