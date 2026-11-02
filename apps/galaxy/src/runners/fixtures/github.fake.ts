import type { AppCredentials, AppInstallation } from '../../public-api/keys/github-app';
import type { AppBot, GithubDeps } from '../runners.service';

// A stubbed GitHub for the runners' tests (PRD 2433 s7, PRD 2573 s1): the service's `GithubDeps` over canned
// answers, recording what it was asked. Every job runs as the Omni App, the one this deployment signs in with:
// its credentials, its bot, its installations and the tokens it mints. The App's own calls to GitHub are proven
// in ../../public-api/keys/github-app.test.ts, and the wiring over them in ../runners.github.test.ts. No key or
// token here is real: the private key is a sentence and the token is built from parts (secret-shapes-guard).

/** The token the stubbed GitHub mints, and when it stops working. */
export const TOKEN = 'gh' + 's_' + 'minted_for_the_tests';
export const EXPIRES = '2026-10-13T13:00:00Z';
/** The Omni App's private key, as the deployment holds it (GITHUB_APP_PRIVATE_KEY). */
export const PRIVATE_KEY = 'the Omni App\'s private key';
/** The Omni App's id and private key (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY). */
export const OMNI_APP: AppCredentials = { appId: '424242', privateKey: PRIVATE_KEY };
/** The Omni App's slug and its bot's id, as GitHub names them. */
export const OMNI_BOT: AppBot = { slug: 'omni-demo', botId: 4242 };
/** The bot every job runs as: the Omni App's. */
export const BOT = { login: 'omni-demo[bot]', email: '4242+omni-demo[bot]@users.noreply.github.com' };
/** The App's installation on the demo organisation, with write access where a job needs it. */
export const INSTALLATION: AppInstallation = { id: 9001, account: 'demo-org', permissions: { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' } };
/** The App's installation on another organisation: a repository there is held by this one, never by `INSTALLATION`. */
export const OTHER_INSTALLATION: AppInstallation = { id: 9002, account: 'other-org', permissions: { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' } };

export type GithubAsked = {
  /** How many times the App's bot was read. */
  bots: number;
  installations: string[];
  minted: { appId: string; privateKey: string; installation: number; repositories: readonly string[] }[];
};

/** What the stub answers for a repository: the installation that holds it, null when the App is not installed on it, or the error GitHub fails with. */
export type Installed = AppInstallation | null | Error;

/** The stubbed deps, any of them replaced by `more`, and what the service asked of them. `installed` says what GitHub answers
 * for a repository's installation (`INSTALLATION` for any it does not list). */
export function stubGithub(more: Partial<GithubDeps> = {}, installed: Readonly<Record<string, Installed>> = {}): { deps: GithubDeps; asked: GithubAsked } {
  const asked: GithubAsked = { bots: 0, installations: [], minted: [] };
  const deps: GithubDeps = {
    credentials: OMNI_APP,
    bot: () => {
      asked.bots += 1;
      return Promise.resolve(OMNI_BOT);
    },
    installation: (_credentials, repo) => {
      asked.installations.push(repo);
      const answer = repo in installed ? installed[repo] ?? null : INSTALLATION;
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    lacks: (installation) => ['contents', 'pull_requests', 'issues'].find((permission) => installation.permissions[permission] !== 'write') ?? null,
    mint: (credentials, installation, repositories) => {
      asked.minted.push({ appId: credentials.appId, privateKey: credentials.privateKey, installation: installation.id, repositories });
      return Promise.resolve({ token: TOKEN, expiresAt: EXPIRES });
    },
    ...more,
  };
  return { deps, asked };
}
