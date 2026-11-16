import 'server-only';
import { masterKey, openSecret } from '../jev/secret-box';
import { appInstallation, checkApp, mintToken, missingPermission, type AppCredentials } from '../public-api/keys/github-app';
import type { AppBot, GithubDeps } from './runners.service';

// The runners' GitHub (PRD 2915 s1, over PRD 2573 s1 and PRD 2433 s7): what the service needs to run a job as the Omni App,
// the App this deployment signs in with, or as its key's own App, over the App's own calls to GitHub
// (../public-api/keys/github-app.ts), each behind an injected fetch so no test reaches GitHub. The Omni App's credentials
// come in as the deployment's GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY, read through the env module by the live wiring
// (./runners.live.ts); a deployment without them holds no Omni App, and its jobs fail saying so. A key's App is opened
// from its sealed private key by the secret box (../jev/secret-box.ts), under SECRETS_MASTER_KEY, which comes in as the raw
// setting: a deployment without one holds no key to open, and every job of a key's App fails saying so.
//
// The App's bot is named by its slug (`GET /app`, then `GET /users/<slug>[bot]`, never with the App's JWT, #2528),
// asked with the token just minted for the job: GitHub limits the route asked with no token by address, which a
// serverless host shares and whose processes come and go (#2656). The live wiring keeps one of these for the server's
// process, and it reads the bot once, as the bot of an App never changes.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function githubDeps(credentials: AppCredentials | null, fetchImpl: Fetch = fetch, clock: () => number = Date.now, rawMasterKey: string | null = null): GithubDeps {
  let named: Promise<AppBot> | null = null;
  const readBot = async (app: AppCredentials, token: string): Promise<AppBot> => {
    const checked = await checkApp(app, fetchImpl, clock, token);
    if (!checked.ok) throw new Error(checked.detail);
    return { slug: checked.slug, botId: checked.botId };
  };
  return {
    credentials,
    master: () => masterKey(rawMasterKey),
    open: (sealed, master) => openSecret(sealed, master),
    bot: (app, token) => {
      named ??= readBot(app, token).catch((error: unknown) => {
        // A read that failed is asked again the next time.
        named = null;
        throw error;
      });
      return named;
    },
    installation: (app, repo) => appInstallation(app, repo, fetchImpl, clock),
    lacks: (installation) => missingPermission(installation),
    mint: (app, installation, repositories) => mintToken(app, installation, repositories, fetchImpl, clock),
  };
}
