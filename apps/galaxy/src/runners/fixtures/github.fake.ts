import type { AppInstallation } from '../../public-api/keys/github-app';
import type { GithubDeps } from '../runners.service';

// A stubbed GitHub and secret box for the runners' tests (PRD 2433 s7): the service's `GithubDeps` over
// canned answers, recording what it was asked. The App's own calls to GitHub are proven in
// ../../public-api/keys/github-app.test.ts, and the wiring over them in ../runners.github.test.ts. No key or
// token here is real: the private key is a sentence and the token is built from parts (secret-shapes-guard).

/** The token the stubbed GitHub mints, and when it stops working. */
export const TOKEN = 'gh' + 's_' + 'minted_for_the_tests';
export const EXPIRES = '2026-10-13T13:00:00Z';
/** What the stubbed secret box opens a sealed key to. */
export const PRIVATE_KEY = 'the private key, opened';
/** The master key the stubbed secret box opens under. */
export const MASTER = Buffer.alloc(32, 7);
/** The App's installation on the demo organisation, with write access where a job needs it. */
export const INSTALLATION: AppInstallation = { id: 9001, account: 'demo-org', permissions: { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' } };
/** The bot a key's App with `KEY_APP` (store.fake.ts) runs as. */
export const BOT = { login: 'acme-bugs[bot]', email: '777+acme-bugs[bot]@users.noreply.github.com' };

export type GithubAsked = {
  opened: string[];
  installations: string[];
  minted: { appId: string; privateKey: string; installation: number; repositories: readonly string[] }[];
};

/** The stubbed deps, any of them replaced by `more`, and what the service asked of them. */
export function stubGithub(more: Partial<GithubDeps> = {}): { deps: GithubDeps; asked: GithubAsked } {
  const asked: GithubAsked = { opened: [], installations: [], minted: [] };
  const deps: GithubDeps = {
    master: () => MASTER,
    open: (sealed, master) => {
      asked.opened.push(`${sealed.ciphertext}/${sealed.iv}`);
      if (master !== MASTER || sealed.ciphertext === 'garbled') throw new Error('Unsupported state or unable to authenticate data');
      return PRIVATE_KEY;
    },
    installation: (_credentials, repo) => {
      asked.installations.push(repo);
      return Promise.resolve(INSTALLATION);
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
