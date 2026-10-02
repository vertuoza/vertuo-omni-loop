// What a sign-in callback does once GitHub's code is a session (PRD 359). Every account signs in
// with GitHub, with the `read:org` scope, so the callback:
//   1. joins by GitHub org: reads the person's login and orgs once, with the provider token Supabase
//      hands back with the new session (src/data/github-orgs.ts), and makes them a member of every
//      workspace of those logins that has an installation (join_workspaces_by_github(), run by
//      galaxy's server as the service role). The token is used for those two reads and dropped: it is
//      never stored, and never sent to the database;
//   2. completes the person's pending sign-up requests (src/signup/installed.ts) whose org, one they
//      still belong to, now has the App installed: create_workspace_from_installation() makes them
//      the new workspace's owner, or a member of the one the org's owner made first;
//   3. when they are still in no workspace, picks up an installation that already exists on their
//      own account or on an org of theirs (an install whose setup never finished, or an org that
//      installed the App before anyone signed up): each becomes their workspace, as the setup would
//      have made it. So a sign-up that stopped half way finishes at the next sign-in, with nothing to
//      type;
//   4. links GitHub (link_github()), so the account is a player at once.
// All are best effort (ADR 0044): a failure is logged, and the sign-in carries on; what needs a
// workspace then refuses with its own message.
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { CliCallbackDeps, CliSession } from '../ask/cli-code';
import { belongsTo, type SignupDeps } from '../signup/installation';
import { joinLogins, type GithubAccount } from './github-orgs';

type Rpc = Pick<SupabaseClient<Database>, 'rpc'>;

/** The new session, as far as joining needs it: whose it is, and GitHub's token when Supabase handed one. */
export type SignedIn = { user: { id: string }; provider_token?: string | null };

/** What joining reaches outside the person's own session: GitHub, and the service role's join; and,
 * to complete sign-up requests, the App's view of GitHub and the service role's sign-up writes. */
export interface SignInDeps {
  readGithub(token: string): Promise<GithubAccount>;
  joinByGithub(userId: string, logins: string[]): Promise<string[]>;
  signup?: SignupDeps;
}

/** The query-string entry the arcade reads on its return (readReturn() in src/arcade/onboarding.ts). */
export type SignInReturn = ['signin', 'ok'] | ['linked', string] | ['link_error', string];

const log = (err: unknown) => console.error(`auth callback: ${err instanceof Error ? err.message : String(err)}`);

async function bestEffort(run: () => Promise<unknown>) {
  try { await run(); } catch (err) { log(err); }
}

/** Who the person is on GitHub, read once with the sign-in's provider token. Throws when it cannot. */
async function readAccount(session: SignedIn, deps: SignInDeps): Promise<GithubAccount> {
  const token = session.provider_token;
  if (!token) throw new Error('no GitHub token came back with this sign-in: nobody joined by org');
  return deps.readGithub(token);
}

/** Finishes each pending sign-up request whose org the person still belongs to and that now has the
 * App installed, one at a time: a failure is logged and leaves that request pending. */
async function completeRequests(userId: string, account: GithubAccount, signup: SignupDeps): Promise<void> {
  const pending = (await signup.pendingRequests(userId)).filter((org) => belongsTo(account, org));
  for (const org of pending) {
    await bestEffort(async () => {
      const installation = await signup.orgInstallation(org);
      if (!installation) return;
      await signup.createWorkspace(userId, installation);
      await signup.dropRequest(userId, org);
    });
  }
}

/** Makes a workspace of every installation of the App already on the person's own account or on an
 * org of theirs, one at a time: a failure is logged and the next is tried. */
async function adoptInstallations(userId: string, account: GithubAccount, signup: SignupDeps): Promise<void> {
  const lookups = [() => signup.userInstallation(account.login), ...account.orgs.map((org) => () => signup.orgInstallation(org))];
  for (const lookup of lookups) {
    await bestEffort(async () => {
      const installation = await lookup();
      if (installation) await signup.createWorkspace(userId, installation);
    });
  }
}

type Linked = { login: string; error: null } | { login: null; error: string };

/** Runs link_github() as the person. Never throws: answers the login, or the refusal. */
export async function linkGithub(db: Rpc): Promise<Linked> {
  try {
    const { data, error } = await db.rpc('link_github');
    if (error) return { login: null, error: error.message };
    const login = propertyOf(data, 'github_login');
    return { login: typeof login === 'string' ? login : '', error: null };
  } catch (err) {
    return { login: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Joins by GitHub org, completes sign-up requests, picks up an existing installation when the
 * person is still in no workspace, then links GitHub as the person (`db`). Never throws. */
export async function settleSignIn(db: Rpc, session: SignedIn, deps: SignInDeps): Promise<Linked> {
  let account: GithubAccount | null = null;
  try { account = await readAccount(session, deps); } catch (err) { log(err); }
  if (account) {
    const known: GithubAccount = account;
    const userId = session.user.id;
    let joined: string[] | null = null;
    try { joined = await deps.joinByGithub(userId, joinLogins(known)); } catch (err) { log(err); }
    const { signup } = deps;
    if (signup) {
      await bestEffort(() => completeRequests(userId, known, signup));
      // Only when joining answered, and answered no workspace: a failed join says nothing either way.
      if (joined !== null && joined.length === 0) await bestEffort(() => adoptInstallations(userId, known, signup));
    }
  }
  return linkGithub(db);
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

/**
 * Where a sign-in from HOME lands (PRD 932), allowlisted: `next` 'app' (the Omni app picked at
 * SELECT YOUR APP) gives /app, and anything else gives /play. Never a path taken from the address.
 */
export function appLanding(next: string | null): '/app' | '/play' {
  return next === 'app' ? '/app' : '/play';
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
