import 'server-only';
import { appInstallation, checkApp, mintToken, missingPermission, type AppCredentials } from '../public-api/keys/github-app';
import type { AppBot, GithubDeps } from './runners.service';

// The runners' GitHub (PRD 2573 s1, over PRD 2433 s7): what the service needs to run every job as the Omni App,
// the App this deployment signs in with, over the App's own calls to GitHub (../public-api/keys/github-app.ts),
// each behind an injected fetch so no test reaches GitHub. The credentials come in as the deployment's
// GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY, read through the env module by the live wiring (./runners.live.ts);
// a deployment without them holds no App, and every job fails saying so.
//
// The App's bot is named by its slug (`GET /app`, then `GET /users/<slug>[bot]`, asked with no token, #2528).
// The live wiring keeps one of these for the server's process, and it reads the bot once: GitHub limits the
// route asked with no token by address, and the bot of an App never changes.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function githubDeps(credentials: AppCredentials | null, fetchImpl: Fetch = fetch, clock: () => number = Date.now): GithubDeps {
  let named: Promise<AppBot> | null = null;
  const readBot = async (app: AppCredentials): Promise<AppBot> => {
    const checked = await checkApp(app, fetchImpl, clock);
    if (!checked.ok) throw new Error(checked.detail);
    return { slug: checked.slug, botId: checked.botId };
  };
  return {
    credentials,
    bot: (app) => {
      named ??= readBot(app).catch((error: unknown) => {
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
