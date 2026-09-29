// GitHub as the omni-loop App sees it (PRD 359): a JWT signed with the App's private key, then three
// reads, an installation by id, an org's installation and a person's own account's installation. The
// PRD page (PRD 426) adds two: a repository's installation, and an installation access token for it. Settings → Repositories (PRD 612) adds the
// repositories an installation reaches, and where its access is changed on GitHub. galaxy's server holds the App's id and key
// (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, server only: never a NEXT_PUBLIC_ variable, never imported
// by a client component); the install link needs only the App's public slug (GITHUB_APP_SLUG).
import { createSign } from 'node:crypto';
import { z } from 'zod';
import type { Installation } from './installation';

export interface AppCredentials { appId: string; privateKey: string }

const LOGIN = /^[A-Za-z0-9-]{1,39}$/;
const GITHUB = 'https://api.github.com';

/** The App's id and key from the server's environment. A key pasted on one line (`\n` escaped, as a
 * dashboard often stores it) is turned back into lines. Throws, naming what is missing. */
export function appCredentials(env: Record<string, string | undefined> = process.env): AppCredentials {
  const appId = env.GITHUB_APP_ID?.trim();
  const key = env.GITHUB_APP_PRIVATE_KEY?.trim();
  const missing = [!appId && 'GITHUB_APP_ID', !key && 'GITHUB_APP_PRIVATE_KEY'].filter(Boolean);
  if (missing.length) throw new Error(`${missing.join(' and ')} not set on this deployment: sign-up cannot read GitHub as the App`);
  return { appId: appId!, privateKey: key!.replace(/\\n/g, '\n') };
}

/** Where a visitor installs the App: its install page on GitHub, or null without a slug. */
export function installUrl(slug: string | undefined): string | null {
  return slug && /^[a-z0-9-]{1,34}$/i.test(slug) ? `https://github.com/apps/${slug}/installations/new` : null;
}

/** Where an installation's repository access is changed on GitHub: the org's installation page, or
 * the person's own for an installation on their account (PRD 612). */
export function installationSettingsUrl({ id, account }: Installation): string {
  return account.type === 'Organization'
    ? `https://github.com/organizations/${account.login}/settings/installations/${id}`
    : `https://github.com/settings/installations/${id}`;
}

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** The App's JWT: RS256, backdated a minute for clock drift, valid nine (GitHub allows ten). */
export function appJwt({ appId, privateKey }: AppCredentials, now = Date.now()): string {
  const iat = Math.floor(now / 1000) - 60;
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: appId, iat, exp: iat + 600 })}`;
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url')}`;
}

const InstallationAnswer = z.object({
  id: z.number().int().positive(),
  account: z.object({ login: z.string().regex(LOGIN), type: z.enum(['Organization', 'User']) }),
});

const TokenAnswer = z.object({ token: z.string().min(1), expires_at: z.string().datetime({ offset: true }) });

const RepositoriesAnswer = z.object({
  total_count: z.number().int().nonnegative(),
  repositories: z.array(z.object({ full_name: z.string(), archived: z.boolean().optional().default(false) })),
});

/** Pages of a hundred repositories read from one installation: past a thousand waits for a need. */
const MAX_REPOSITORY_PAGES = 10;

/** An installation access token and when it expires (epoch ms). Server memory only: never sent to a page. */
export interface InstallationToken { token: string; expiresAt: number }

/** `owner/name`, as GitHub spells a repository. */
export const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function githubApp(creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now) {
  const call = (path: string, method: 'GET' | 'POST' = 'GET') => fetchImpl(`${GITHUB}${path}`, {
    method,
    headers: { authorization: `Bearer ${appJwt(creds, clock())}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    cache: 'no-store',
  });

  async function read(path: string): Promise<Installation | null> {
    const res = await call(path);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${path}`);
    const parsed = InstallationAnswer.safeParse(await res.json());
    if (!parsed.success) throw new Error(`GitHub's answer to ${path} is not the shape it documents`);
    const { id, account } = parsed.data;
    return { id, account: { login: account.login, type: account.type } };
  }

  /** A fresh installation access token. Throws when GitHub answers an error or an odd shape. */
  async function installationToken(id: number): Promise<InstallationToken> {
    if (!Number.isInteger(id) || id < 1) throw new Error(`${JSON.stringify(id)} is not an installation id`);
    const path = `/app/installations/${id}/access_tokens`;
    const res = await call(path, 'POST');
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${path}`);
    const parsed = TokenAnswer.safeParse(await res.json());
    if (!parsed.success) throw new Error(`GitHub's answer to ${path} is not the shape it documents`);
    return { token: parsed.data.token, expiresAt: Date.parse(parsed.data.expires_at) };
  }

  return {
    installation: (id: number) => read(`/app/installations/${id}`),
    orgInstallation(org: string) {
      if (!LOGIN.test(org)) return Promise.reject(new Error(`${JSON.stringify(org)} is not a GitHub login`));
      return read(`/orgs/${org}/installation`);
    },
    userInstallation(login: string) {
      if (!LOGIN.test(login)) return Promise.reject(new Error(`${JSON.stringify(login)} is not a GitHub login`));
      return read(`/users/${login}/installation`);
    },
    /** The App's installation on the repository `owner/name`; null when it is not installed there. */
    repoInstallation(repo: string) {
      if (!REPO.test(repo)) return Promise.reject(new Error(`${JSON.stringify(repo)} is not a GitHub repository`));
      return read(`/repos/${repo}/installation`);
    },
    installationToken,
    /** Every repository installation `id` reaches, as GitHub spells it, archived ones left out (PRD
     * 612). Read with a fresh installation token. Throws when GitHub answers an error or an odd shape. */
    async installationRepositories(id: number): Promise<string[]> {
      const { token } = await installationToken(id);
      const names: string[] = [];
      for (let page = 1; page <= MAX_REPOSITORY_PAGES; page += 1) {
        const path = `/installation/repositories?per_page=100&page=${page}`;
        const res = await fetchImpl(`${GITHUB}${path}`, {
          headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${path}`);
        const parsed = RepositoriesAnswer.safeParse(await res.json());
        if (!parsed.success) throw new Error(`GitHub's answer to ${path} is not the shape it documents`);
        const { repositories, total_count } = parsed.data;
        names.push(...repositories.filter((r) => !r.archived && REPO.test(r.full_name)).map((r) => r.full_name));
        if (repositories.length < 100 || page * 100 >= total_count) break;
      }
      return names;
    },
  };
}
