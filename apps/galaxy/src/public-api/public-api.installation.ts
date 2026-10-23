import 'server-only';
import { MASTER_KEY_VAR, openSecret } from '../jev/secret-box';
import { appInstallation, missingPermission } from './keys/github-app';
import type { CheckInstallation } from './public-api.service';

// Asking GitHub about a key's App on a repository (PRD 2433 s6, spec "At send"): the Node-only half of the
// send-time check, so the service's rules (./public-api.service.ts) stay free of the secret box and of
// GitHub. The App's private key is opened under the deployment's master key only to sign this one call
// (keys/github-app.ts, behind an injected fetch) and goes no further; a key that cannot be opened, or an
// answer GitHub does not give, throws, and the controller answers 500 with nothing queued. What is thrown
// names GitHub's status and the path, or the master key's variable: never the private key, its sealed
// form or GitHub's own words (L-GDPR-2).

type Fetch = NonNullable<Parameters<typeof appInstallation>[2]>;

/**
 * The check the service asks at send: the App's installation on `repo`, and whether it holds write access
 * to contents, pull_requests and issues. `master` gives the master key the private key was sealed under,
 * or null on a deployment with none.
 */
export function installationChecker(master: () => Buffer | null, fetchImpl?: Fetch, clock?: () => number): CheckInstallation {
  return async (app, repo) => {
    const key = master();
    if (key === null) throw new Error(`${MASTER_KEY_VAR} is missing or malformed, so the App's private key cannot be opened`);
    const installation = await appInstallation({ appId: String(app.appId), privateKey: openSecret(app, key) }, repo, fetchImpl, clock);
    return installation === null ? { installed: false } : { installed: true, missing: missingPermission(installation) };
  };
}
