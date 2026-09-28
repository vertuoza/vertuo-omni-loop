// What a sign-in callback does once GitHub's code is a session (PRD 359). Every account signs in
// with GitHub, with the `read:org` scope, so the callback:
//   1. joins by GitHub org: reads the person's login and orgs once, with the provider token Supabase
//      hands back with the new session (src/data/github-orgs.ts), and makes them a member of every
//      workspace of those logins that has an installation (join_workspaces_by_github(), run by
//      galaxy's server as the service role). The token is used for those two reads and dropped: it is
//      never stored, and never sent to the database;
//   2. links GitHub (link_github()), so the account is a player at once.
// Both are best effort (ADR 0044): a failure is logged, and the sign-in carries on; what needs a
// workspace then refuses with its own message.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CliCallbackDeps, CliSession } from '../ask/cli-code';
import { joinLogins, type GithubAccount } from './github-orgs';

type Rpc = Pick<SupabaseClient, 'rpc'>;

/** The new session, as far as joining needs it: whose it is, and GitHub's token when Supabase handed one. */
export type SignedIn = { user: { id: string }; provider_token?: string | null };

/** What joining reaches outside the person's own session: GitHub, and the service role's join. */
export interface SignInDeps {
  readGithub(token: string): Promise<GithubAccount>;
  joinByGithub(userId: string, logins: string[]): Promise<string[]>;
}

/** The query-string entry the arcade reads on its return (readReturn() in src/arcade/onboarding.ts). */
export type SignInReturn = ['signin', 'ok'] | ['linked', string] | ['link_error', string];

const log = (err: unknown) => console.error(`auth callback: ${err instanceof Error ? err.message : String(err)}`);

async function bestEffort(run: () => Promise<unknown>) {
  try { await run(); } catch (err) { log(err); }
}

/** Joins the workspaces of the person's GitHub orgs. Throws when it cannot. */
async function joinByOrgs(session: SignedIn, deps: SignInDeps): Promise<void> {
  const token = session.provider_token;
  if (!token) throw new Error('no GitHub token came back with this sign-in: nobody joined by org');
  const account = await deps.readGithub(token);
  await deps.joinByGithub(session.user.id, joinLogins(account));
}

type Linked = { login: string; error: null } | { login: null; error: string };

async function link(db: Rpc): Promise<Linked> {
  try {
    const { data, error } = await db.rpc('link_github');
    if (error) return { login: null, error: error.message };
    return { login: (data as { github_login?: string } | null)?.github_login ?? '', error: null };
  } catch (err) {
    return { login: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Joins by GitHub org, then links GitHub as the person (`db`). Never throws. */
export async function settleSignIn(db: Rpc, session: SignedIn, deps: SignInDeps): Promise<Linked> {
  await bestEffort(() => joinByOrgs(session, deps));
  return link(db);
}

/** After an arcade sign-in: settles it, then answers what the arcade shows. `next` 'link' is the
 * arcade's link step, which answers the linked login or the refusal; a plain sign-in only logs one. */
export async function afterSignIn(db: Rpc, session: SignedIn | null, deps: SignInDeps, next: string | null): Promise<SignInReturn> {
  if (!session) return ['signin', 'ok'];
  const linked = await settleSignIn(db, session, deps);
  if (next === 'link') return linked.error === null ? ['linked', linked.login] : ['link_error', linked.error];
  if (linked.error !== null) log(linked.error);
  return ['signin', 'ok'];
}

/** Supabase's exchangeCodeForSession, as far as a page's callback reads it. */
export type SessionExchange = (code: string) => Promise<{ data: { session: SignedIn | null } | null; error: { message: string } | null }>;

/** For a page's own callback (ask, knowledge, dossiers): the exchange, then the sign-in settled as
 * the arcade's is, before the page reads as the person. Answers only the exchange's error. */
export function settlingExchange(exchange: SessionExchange, db: Rpc, deps: SignInDeps) {
  return async (code: string): Promise<{ error: { message: string } | null }> => {
    const { data, error } = await exchange(code);
    if (error) return { error };
    if (data?.session) await settleSignIn(db, data.session, deps);
    return { error: null };
  };
}

/** The terminal's sign-in steps, joining as the new sign-in before its one-time code is issued. */
export function joinBeforeIssue(deps: CliCallbackDeps, joinAs: (session: CliSession) => Promise<unknown>): CliCallbackDeps {
  return {
    ...deps,
    async issue(session, codeHash) {
      await bestEffort(() => joinAs(session));
      return deps.issue(session, codeHash);
    },
  };
}
