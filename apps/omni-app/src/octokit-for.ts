// The one shape a function takes its GitHub client by: `octokitFor(installationId)`, so a test hands a
// stubbed client and the app hands an installation's (`installationOctokitFor`). `Client` is the part
// of Octokit the function calls.
//
// Every installation's Octokit sends its calls through the shared budget-aware client (`@omni/github`,
// PRD 902): the installation's budget, spent at `background` priority (the app's work is checks,
// retros and harvests, never a person waiting), with the ETags and the pause galaxy shares. Minting
// the installation token is an App-JWT call, on the App's own budget, so it goes out plain.
import { App } from '@octokit/app';
import { createClient } from '@supabase/supabase-js';
import { supabaseGithubStore, type GithubClient, type GithubStore, type PlainFetch } from '@omni/github';
import type { Database } from '../../../supabase/database.types.ts';
import { GITHUB_APP, requireGroup, type GithubAppEnv, type SupabaseEnv } from './env.ts';

/** An installation's GitHub client, for its id. */
export type OctokitFor<Client> = (installationId: number) => Promise<Client> | Client;

/** The App's own calls (`/app/…`, its token minted with its JWT), which spend the App's budget, not an installation's. */
const APP_CALL = /^(\/api\/v3)?\/app(\/|$)/;

/**
 * An installation's Octokit, signed with the GitHub App's id and private key (`GITHUB_APP_ID`,
 * `GITHUB_APP_PRIVATE_KEY`, ./env.ts), whose every call goes through `github`, spending the
 * installation's budget, but the App's own calls (its token's minting), which go out plain. Required
 * in production; elsewhere, unset, the first call throws the `EnvError` naming both, as the first
 * GitHub read of a run.
 */
export function installationOctokitFor(githubApp: GithubAppEnv | null, github: GithubClient) {
  let app: App | undefined;
  return async (installationId: number) => {
    const { id, privateKey } = requireGroup(githubApp, GITHUB_APP, 'the app reads GitHub as an installation');
    app ??= new App({ appId: id, privateKey });
    const octokit = await app.getInstallationOctokit(installationId);
    const budgeted = github.bound({ installation: installationId, priority: 'background' });
    const fetch: PlainFetch = (url, init) => (APP_CALL.test(new URL(url).pathname) ? globalThis.fetch(url, init) : budgeted(url, init));
    // Each call's own options, merged fresh per call: the hooks after this one, the token's included, read them.
    octokit.hook.before('request', (options) => {
      options.request = { ...options.request, fetch };
    });
    return octokit;
  };
}

/**
 * The client's store on the database, as the service role (`SUPABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`): `github_etags` and `github_budget`, which galaxy writes too. Unset,
 * none: the client calls GitHub plain, with no shared budget.
 */
export function githubStoreOf(supabase: SupabaseEnv | null): GithubStore | null {
  if (!supabase) return null;
  const db = createClient<Database>(supabase.url, supabase.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return supabaseGithubStore({ etags: () => db.from('github_etags'), budget: () => db.from('github_budget') });
}
