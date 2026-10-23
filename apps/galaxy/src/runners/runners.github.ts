import 'server-only';
import { masterKey, openSecret } from '../jev/secret-box';
import { appInstallation, mintToken, missingPermission } from '../public-api/keys/github-app';
import type { GithubDeps } from './runners.service';

// The runners' GitHub (PRD 2433 s7): what the service needs to run a key's job as its GitHub App, over the
// two modules that already do each part: the secret box that opens the key's private key under
// SECRETS_MASTER_KEY, and the App's own calls to GitHub (../public-api/keys/github-app.ts), each behind an
// injected fetch so no test reaches GitHub. The master key comes in as the raw setting, read through the
// env module by the live wiring (./runners.live.ts); a deployment without one holds no key to open, and
// every job of a key with an App fails saying so.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function githubDeps(rawMasterKey: string | null, fetchImpl: Fetch = fetch, clock: () => number = Date.now): GithubDeps {
  return {
    master: () => masterKey(rawMasterKey),
    open: (sealed, master) => openSecret(sealed, master),
    installation: (credentials, repo) => appInstallation(credentials, repo, fetchImpl, clock),
    lacks: (installation) => missingPermission(installation),
    mint: (credentials, installation, repositories) => mintToken(credentials, installation, repositories, fetchImpl, clock),
  };
}
