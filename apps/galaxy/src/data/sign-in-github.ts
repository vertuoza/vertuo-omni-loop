// How every sign-in surface starts a sign-in (PRD 359): GitHub, the only provider, with the
// `read:org` scope, so the callback can read the person's orgs (private memberships included) and
// join their workspaces (src/data/sign-in.ts). Nothing filters the account chooser: who gets in is
// the sign-up hook's and the workspaces' business, not the button's. A voter on a public ideas board
// (PRD 1246) signs in with `orgs: false`: no `read:org`, since a voter needs no workspace.
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types.ts';

/** The scopes galaxy asks GitHub for, beyond Supabase's own (the account and its email). */
export const GITHUB_SCOPES = 'read:org';

/** How a sign-in starts: `fromServer`, a route that redirects the visitor itself (like
 * /signup/installed); `orgs: false`, a voter's, which asks GitHub for no scope of galaxy's own. */
export type SignInOptions = { fromServer?: boolean; orgs?: boolean };

/** The argument to Supabase's signInWithOAuth, coming back to `redirectTo`. Started `fromServer`, it
 * answers GitHub's address instead of leaving for it. */
export function githubSignIn(redirectTo: string, { fromServer = false, orgs = true }: SignInOptions = {}) {
  const options = orgs ? { redirectTo, scopes: GITHUB_SCOPES } : { redirectTo };
  return { provider: 'github' as const, options: fromServer ? { ...options, skipBrowserRedirect: true } : options };
}

/** A sign-in card's button, in the browser: leaves for GitHub, coming back to `redirectTo`. Resolves
 * with what to show when it could not start, or null while the page leaves. */
export async function startGithubSignIn(supabase: { url: string; key: string }, redirectTo: string, { orgs = true }: Pick<SignInOptions, 'orgs'> = {}): Promise<string | null> {
  const { error } = await createBrowserClient<Database>(supabase.url, supabase.key).auth.signInWithOAuth(githubSignIn(redirectTo, { orgs }));
  return error ? `GitHub sign-in could not start: ${error.message}` : null;
}
