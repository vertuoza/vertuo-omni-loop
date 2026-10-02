// Signing in from /prd/<id> (PRD 216), as the ask pages do: the galaxy's GitHub sign-in, coming back
// through the dossier's own callback, /prd/<id>/callback, which turns the code into the session cookie
// and goes back to the same dossier, carrying the reason when the sign-in was refused. A link to a
// dossier is often someone's first visit, so the callback also joins the workspaces of the person's
// GitHub orgs (src/data/sign-in.ts, as the arcade's callback does) before the page reads as them:
// best effort, since a failure only leaves the page saying not found. It only ever returns to
// this site: anything that is not a dossier id goes home. /prd, the history (step 4), signs in the same
// way through /prd/callback, and comes back to /prd; a list of fixes (PRD 627) through its own
// /visual/callback or /bugs/callback, back to itself.
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Exchange } from '../../ask/page/sign-in';
import { HISTORY_PATH } from './history';
import { dossierPath } from './view';
import { isDossierId } from './source';

/** Where GitHub sends the person back after signing in on a dossier. */
export const dossierCallbackPath = (id: string) => `${dossierPath(id)}/callback`;

/** Joins the account's workspaces, once the sign-in is a session. */
export type Join = () => Promise<unknown>;

/** Where the callback sends the person. `exchange` and `join` are null when this deployment has no database. */
export async function dossierSignInReturn(url: URL, origin: string, id: string, exchange: Exchange | null, join: Join | null): Promise<string> {
  return signInReturn(url, new URL(isDossierId(id) ? dossierPath(id) : '/', origin), exchange, join);
}

/** Where a list's callback sends the person: back to the list, /prd unless another is named (a fix's
 * list, /visual or /bugs: PRD 627). */
export async function historySignInReturn(url: URL, origin: string, exchange: Exchange | null, join: Join | null, list: string = HISTORY_PATH): Promise<string> {
  return signInReturn(url, new URL(list, origin), exchange, join);
}

async function signInReturn(url: URL, back: URL, exchange: Exchange | null, join: Join | null): Promise<string> {
  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (refused) {
    back.searchParams.set('signin_error', refused);
  } else if (code && exchange) {
    const { error } = await exchange(code);
    if (error) {
      console.error(`dossier sign-in: ${error.message}`);
      back.searchParams.set('signin_error', 'That sign-in could not be finished. Start again from this browser.');
    } else if (join) {
      try {
        await join();
      } catch (failure) {
        console.error(`dossier sign-in: ${messageOf(failure)}`);
      }
    }
  }
  return back.toString();
}
