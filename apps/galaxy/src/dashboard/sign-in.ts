import type { Exchange } from '../ask/page/sign-in';
import { APP_HOME } from '../switch/switch';

// Signing in from /app, the dashboard (PRD 328): the galaxy's Google sign-in, coming back through
// /app/callback, which turns the code into the session cookie, joins the workspaces of the account's
// confirmed email domain (join_by_domain(), as the arcade's and the dossiers' callbacks do), then
// returns to /app, carrying the reason when the sign-in was refused. Joining is best effort: a
// failure only leaves the page saying the account is in no workspace. It only ever returns to /app.

/** Where Google sends the person back after signing in on the dashboard. */
export const APP_CALLBACK = `${APP_HOME}/callback`;

/** Joins the account's workspaces, once the sign-in is a session. */
export type Join = () => Promise<unknown>;

/** Where the callback sends the person: /app, with `signin_error` when the sign-in failed. `exchange`
 * and `join` are null when this deployment has no database. */
export async function dashboardSignInReturn(url: URL, origin: string, exchange: Exchange | null, join: Join | null): Promise<string> {
  const back = new URL(APP_HOME, origin);
  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (refused) {
    back.searchParams.set('signin_error', refused);
  } else if (code && exchange) {
    const { error } = await exchange(code);
    if (error) {
      console.error(`dashboard sign-in: ${error.message}`);
      back.searchParams.set('signin_error', 'That sign-in could not be finished. Start again from this browser.');
    } else if (join) {
      try {
        await join();
      } catch (failure) {
        console.error(`dashboard sign-in: ${(failure as Error).message}`);
      }
    }
  }
  return back.toString();
}
