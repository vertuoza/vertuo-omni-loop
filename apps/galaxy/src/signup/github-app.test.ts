import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { readEnv } from '../env';
import { appCredentials, appJwt, githubApp, installationSettingsUrl, installUrl, reachedRepositories } from './github-app';
import { item, present } from '../ask/test/test-item';

vi.mock('server-only', () => ({}));

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const CREDS = { appId: '123456', privateKey: PEM };
const NOW = Date.parse('2026-09-28T10:00:00Z');

const part = (jwt: string, i: number): unknown => JSON.parse(Buffer.from(item(jwt.split('.'), i), 'base64url').toString('utf8'));

describe('the App\'s JWT', () => {
  it('is signed RS256 with the App\'s key, issued by the App, for under ten minutes', () => {
    const jwt = appJwt(CREDS, NOW);
    const [head, body, sig] = jwt.split('.');
    expect(part(jwt, 0)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(part(jwt, 1)).toEqual({ iss: '123456', iat: NOW / 1000 - 60, exp: NOW / 1000 + 540 });
    expect(createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(present(sig, 'sig'), 'base64url'))).toBe(true);
  });
});

describe('the App\'s credentials, from the server\'s environment', () => {
  it('reads the id and the key, turning an escaped key back into lines', () => {
    const env = { GITHUB_APP_ID: '123456', GITHUB_APP_PRIVATE_KEY: PEM.replace(/\n/g, '\\n') };
    expect(appCredentials(readEnv(env).githubApp)).toEqual(CREDS);
  });

  it('throws, naming both, when the App is not set up', () => {
    expect(() => appCredentials(null)).toThrow(/GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY not set/);
  });

  it('is refused at startup, naming what is missing, when either is not set', () => {
    expect(() => readEnv({ GITHUB_APP_ID: '1' })).toThrow(/GITHUB_APP_PRIVATE_KEY is not set/);
    expect(() => readEnv({ GITHUB_APP_PRIVATE_KEY: PEM })).toThrow(/GITHUB_APP_ID is not set/);
  });
});

describe('the install link', () => {
  it('points at the App\'s install page on GitHub', () => {
    expect(installUrl('omni-loop')).toBe('https://github.com/apps/omni-loop/installations/new');
  });

  it('is null without a valid slug', () => {
    expect(installUrl(undefined)).toBeNull();
    expect(installUrl('')).toBeNull();
    expect(installUrl('../evil')).toBeNull();
  });
});

describe('what the App reads from GitHub', () => {
  const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const INSTALLATION = { id: 5001, account: { login: 'Acme', type: 'Organization', id: 9 }, app_id: 123456 };

  it('fetches an installation with the App\'s JWT', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(answer(200, INSTALLATION)));
    expect(await githubApp(CREDS, fetchImpl, () => NOW).installation(5001)).toEqual({ id: 5001, account: { login: 'Acme', type: 'Organization' } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/app/installations/5001');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${appJwt(CREDS, NOW)}`);
  });

  it('answers null for an installation GitHub does not know', async () => {
    expect(await githubApp(CREDS, () => Promise.resolve(answer(404, { message: 'Not Found' }))).installation(1)).toBeNull();
  });

  it('throws when GitHub answers an error, or an odd shape', async () => {
    await expect(githubApp(CREDS, () => Promise.resolve(answer(500, {}))).installation(1)).rejects.toThrow(/500/);
    await expect(githubApp(CREDS, () => Promise.resolve(answer(401, {}))).installation(1)).rejects.toThrow(/401/);
    await expect(githubApp(CREDS, () => Promise.resolve(answer(200, { id: 'x' }))).installation(1)).rejects.toThrow(/shape/);
    await expect(githubApp(CREDS, () => Promise.resolve(answer(200, { ...INSTALLATION, account: { login: 'a', type: 'Enterprise' } }))).installation(1)).rejects.toThrow(/shape/);
  });

  it('finds an org\'s installation, or null when it has none', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(answer(200, INSTALLATION)));
    expect(await githubApp(CREDS, fetchImpl).orgInstallation('Acme')).toEqual({ id: 5001, account: { login: 'Acme', type: 'Organization' } });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.github.com/orgs/Acme/installation');
    expect(await githubApp(CREDS, () => Promise.resolve(answer(404, {}))).orgInstallation('nobody')).toBeNull();
  });

  it('never puts an odd org name in a GitHub address', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(answer(200, INSTALLATION)));
    await expect(githubApp(CREDS, fetchImpl).orgInstallation('../app')).rejects.toThrow(/not a GitHub login/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('finds the installation on a person\'s own account, or null when it has none', async () => {
    const own = { id: 7001, account: { login: 'dan-gh', type: 'User' } };
    const fetchImpl = vi.fn(() => Promise.resolve(answer(200, own)));
    expect(await githubApp(CREDS, fetchImpl).userInstallation('dan-gh')).toEqual(own);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.github.com/users/dan-gh/installation');
    expect(await githubApp(CREDS, () => Promise.resolve(answer(404, {}))).userInstallation('nobody')).toBeNull();
    await expect(githubApp(CREDS, fetchImpl).userInstallation('../app')).rejects.toThrow(/not a GitHub login/);
  });

  it('finds the App\'s installation on a repository, or null when it is not installed there (PRD 426)', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(answer(200, INSTALLATION)));
    expect(await githubApp(CREDS, fetchImpl).repoInstallation('Acme/widgets.js')).toEqual({ id: 5001, account: { login: 'Acme', type: 'Organization' } });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.github.com/repos/Acme/widgets.js/installation');
    expect(await githubApp(CREDS, () => Promise.resolve(answer(404, {}))).repoInstallation('acme/none')).toBeNull();
    await expect(githubApp(CREDS, fetchImpl).repoInstallation('acme/../x/y')).rejects.toThrow(/not a GitHub repository/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('creates an installation access token with a POST signed by the App (PRD 426)', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(answer(201, { token: 'ghs_abc', expires_at: '2026-09-28T11:00:00Z', permissions: {} })));
    expect(await githubApp(CREDS, fetchImpl, () => NOW).installationToken(5001)).toEqual({ token: 'ghs_abc', expiresAt: Date.parse('2026-09-28T11:00:00Z') });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/app/installations/5001/access_tokens');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${appJwt(CREDS, NOW)}`);
    await expect(githubApp(CREDS, () => Promise.resolve(answer(403, {}))).installationToken(5001)).rejects.toThrow(/403/);
    await expect(githubApp(CREDS, () => Promise.resolve(answer(201, { token: '' }))).installationToken(5001)).rejects.toThrow(/shape/);
  });
});

describe('the repositories an installation reaches (PRD 612)', () => {
  const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const repo = (full_name: string, archived = false) => ({ full_name, archived });

  it('lists every page of an installation token\'s repositories, archived ones left out, through the fetch it is handed', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => repo(`Acme/r${i}`));
    const fetchImpl = vi.fn<(url: string, init: RequestInit) => Promise<Response>>((url) => {
      if (url.endsWith('page=1')) return Promise.resolve(answer(200, { total_count: 102, repositories: page1 }));
      return Promise.resolve(answer(200, { total_count: 102, repositories: [repo('Acme/last'), repo('Acme/old', true)] }));
    });
    const names = await reachedRepositories('ghs_abc', fetchImpl);
    expect(names).toHaveLength(101);
    expect(names).toContain('Acme/last');
    expect(names).not.toContain('Acme/old');
    const [url, init] = present(fetchImpl.mock.calls[0], 'the first call');
    expect(url).toBe('https://api.github.com/installation/repositories?per_page=100&page=1');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer ghs_abc');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws when GitHub answers an error or an odd shape', async () => {
    const failing = (status: number, body: unknown) => () => Promise.resolve(answer(status, body));
    await expect(reachedRepositories('ghs_abc', failing(500, {}))).rejects.toThrow(/500/);
    await expect(reachedRepositories('ghs_abc', failing(200, { repositories: 'x' }))).rejects.toThrow(/shape/);
  });
});

describe('the installation\'s settings page on GitHub (PRD 612)', () => {
  it('is the org\'s installation page for an org, the account\'s own for a person', () => {
    expect(installationSettingsUrl({ id: 5001, account: { login: 'vertuoza', type: 'Organization' } }))
      .toBe('https://github.com/organizations/vertuoza/settings/installations/5001');
    expect(installationSettingsUrl({ id: 7, account: { login: 'pierre', type: 'User' } }))
      .toBe('https://github.com/settings/installations/7');
  });
});
