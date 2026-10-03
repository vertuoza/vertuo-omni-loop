import { signInBackTo, type Exchange, type Join } from '../ask/page/sign-in';
import { APP_HOME } from '../switch/switch';

// Signing in from /app, the dashboard (PRD 328): the galaxy's GitHub sign-in (PRD 359), coming back
// through /app/callback, which turns the code into the session cookie, joins the workspaces of the
// person's GitHub orgs and links GitHub (settleSignIn(), as the arcade's and the dossiers' callbacks
// do), then returns to /app, carrying the reason when the sign-in was refused. Joining is best effort: a
// failure only leaves the page saying the account is in no workspace. It only ever returns to /app.

/** Where GitHub sends the person back after signing in on the dashboard. */
export const APP_CALLBACK = `${APP_HOME}/callback`;

/** Where the callback sends the person: /app, with `signin_error` when the sign-in failed. `exchange`
 * and `join` are null when this deployment has no database. */
export async function dashboardSignInReturn(url: URL, origin: string, exchange: Exchange | null, join: Join | null): Promise<string> {
  return signInBackTo(url, new URL(APP_HOME, origin), exchange, 'dashboard', join);
}
