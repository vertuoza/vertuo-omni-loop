import type { Exchange } from '../ask/page/sign-in';

// Signing in from the knowledge map (PRD 149): the galaxy's Google sign-in, coming back through the
// page's own callback, which turns the code into the session cookie and returns to /knowledge on the
// entry the address named, carrying the reason when the sign-in was refused. It only ever returns to
// /knowledge on this site, and carries nothing but the repository, the domain and the entry.

const CALLBACK = '/knowledge/callback';
const KEPT = ['repo', 'domain', 'entry'] as const;

type Wanted = { repo?: string | null; domain?: string | null; entry?: string | null };

function kept(from: Wanted): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of KEPT) {
    const value = from[key];
    if (value) query.set(key, value);
  }
  return query;
}

const withQuery = (path: string, query: URLSearchParams) => (String(query) ? `${path}?${query}` : path);

/** Where Google sends the person back after signing in on the knowledge map. */
export const knowledgeCallbackPath = (wanted: Wanted) => withQuery(CALLBACK, kept(wanted));

/** Where the callback sends the person: /knowledge, on the same entry, with `signin_error` when the
 * sign-in failed. `exchange` is null when this deployment has no database. */
export async function knowledgeSignInReturn(url: URL, origin: string, exchange: Exchange | null): Promise<string> {
  const params = url.searchParams;
  const back = new URL(withQuery('/knowledge', kept({ repo: params.get('repo'), domain: params.get('domain'), entry: params.get('entry') })), origin);
  const refused = params.get('error_description') ?? params.get('error');
  const code = params.get('code');
  if (refused) {
    back.searchParams.set('signin_error', refused);
  } else if (code && exchange) {
    const { error } = await exchange(code);
    if (error) {
      console.error(`knowledge sign-in: ${error.message}`);
      back.searchParams.set('signin_error', 'That sign-in could not be finished. Start again from this browser.');
    }
  }
  return back.toString();
}
