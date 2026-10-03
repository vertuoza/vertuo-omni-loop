// The one shape a function takes its GitHub client by: `octokitFor(installationId)`, so a test hands a
// stubbed client and the app hands an installation's (`installationOctokitFor`). `Client` is the part
// of Octokit the function calls.
import { App } from '@octokit/app';
import { GITHUB_APP, requireGroup, type GithubAppEnv } from './env.ts';

/** An installation's GitHub client, for its id. */
export type OctokitFor<Client> = (installationId: number) => Promise<Client> | Client;

/**
 * An installation's Octokit, signed with the GitHub App's id and private key (`GITHUB_APP_ID`,
 * `GITHUB_APP_PRIVATE_KEY`, ./env.ts). Required in production; elsewhere, unset, the first call
 * throws the `EnvError` naming both, as the first GitHub read of a run.
 */
export function installationOctokitFor(githubApp: GithubAppEnv | null) {
  let app: App | undefined;
  return (installationId: number) => {
    const { id, privateKey } = requireGroup(githubApp, GITHUB_APP, 'the app reads GitHub as an installation');
    app ??= new App({ appId: id, privateKey });
    return app.getInstallationOctokit(installationId);
  };
}
