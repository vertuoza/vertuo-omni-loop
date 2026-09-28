// GitHub as the omni-loop App sees it (PRD 359): a JWT signed with the App's private key, then two
// reads, an installation by id and an org's installation. galaxy's server holds the App's id and key
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

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function githubApp(creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now) {
  async function read(path: string): Promise<Installation | null> {
    const res = await fetchImpl(`${GITHUB}${path}`, {
      headers: { authorization: `Bearer ${appJwt(creds, clock())}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${path}`);
    const parsed = InstallationAnswer.safeParse(await res.json());
    if (!parsed.success) throw new Error(`GitHub's answer to ${path} is not the shape it documents`);
    const { id, account } = parsed.data;
    return { id, account: { login: account.login, type: account.type } };
  }
  return {
    installation: (id: number) => read(`/app/installations/${id}`),
    orgInstallation(org: string) {
      if (!LOGIN.test(org)) return Promise.reject(new Error(`${JSON.stringify(org)} is not a GitHub login`));
      return read(`/orgs/${org}/installation`);
    },
  };
}
