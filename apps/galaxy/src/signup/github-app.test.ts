import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { appCredentials, appJwt, githubApp, installUrl } from './github-app';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const CREDS = { appId: '123456', privateKey: PEM };
const NOW = Date.parse('2026-09-28T10:00:00Z');

const part = (jwt: string, i: number) => JSON.parse(Buffer.from(jwt.split('.')[i], 'base64url').toString('utf8'));

describe('the App\'s JWT', () => {
  it('is signed RS256 with the App\'s key, issued by the App, for under ten minutes', () => {
    const jwt = appJwt(CREDS, NOW);
    const [head, body, sig] = jwt.split('.');
    expect(part(jwt, 0)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(part(jwt, 1)).toEqual({ iss: '123456', iat: NOW / 1000 - 60, exp: NOW / 1000 + 540 });
    expect(createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
  });
});

describe('the App\'s credentials, from the server\'s environment', () => {
  it('reads the id and the key, turning an escaped key back into lines', () => {
    const env = { GITHUB_APP_ID: '123456', GITHUB_APP_PRIVATE_KEY: PEM.replace(/\n/g, '\\n') };
    expect(appCredentials(env)).toEqual(CREDS);
  });

  it('throws, naming what is missing, when either is not set', () => {
    expect(() => appCredentials({ GITHUB_APP_ID: '1' })).toThrow(/GITHUB_APP_PRIVATE_KEY/);
    expect(() => appCredentials({ GITHUB_APP_PRIVATE_KEY: PEM })).toThrow(/GITHUB_APP_ID/);
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
    const fetchImpl = vi.fn(async () => answer(200, INSTALLATION));
    expect(await githubApp(CREDS, fetchImpl, () => NOW).installation(5001)).toEqual({ id: 5001, account: { login: 'Acme', type: 'Organization' } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/app/installations/5001');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${appJwt(CREDS, NOW)}`);
  });

  it('answers null for an installation GitHub does not know', async () => {
    expect(await githubApp(CREDS, async () => answer(404, { message: 'Not Found' })).installation(1)).toBeNull();
  });

  it('throws when GitHub answers an error, or an odd shape', async () => {
    await expect(githubApp(CREDS, async () => answer(500, {})).installation(1)).rejects.toThrow(/500/);
    await expect(githubApp(CREDS, async () => answer(401, {})).installation(1)).rejects.toThrow(/401/);
    await expect(githubApp(CREDS, async () => answer(200, { id: 'x' })).installation(1)).rejects.toThrow(/shape/);
    await expect(githubApp(CREDS, async () => answer(200, { ...INSTALLATION, account: { login: 'a', type: 'Enterprise' } })).installation(1)).rejects.toThrow(/shape/);
  });

  it('finds an org\'s installation, or null when it has none', async () => {
    const fetchImpl = vi.fn(async () => answer(200, INSTALLATION));
    expect(await githubApp(CREDS, fetchImpl).orgInstallation('Acme')).toEqual({ id: 5001, account: { login: 'Acme', type: 'Organization' } });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.github.com/orgs/Acme/installation');
    expect(await githubApp(CREDS, async () => answer(404, {})).orgInstallation('nobody')).toBeNull();
  });

  it('never puts an odd org name in a GitHub address', async () => {
    const fetchImpl = vi.fn(async () => answer(200, INSTALLATION));
    await expect(githubApp(CREDS, fetchImpl).orgInstallation('../app')).rejects.toThrow(/not a GitHub login/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('finds the installation on a person\'s own account, or null when it has none', async () => {
    const own = { id: 7001, account: { login: 'dan-gh', type: 'User' } };
    const fetchImpl = vi.fn(async () => answer(200, own));
    expect(await githubApp(CREDS, fetchImpl).userInstallation('dan-gh')).toEqual(own);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://api.github.com/users/dan-gh/installation');
    expect(await githubApp(CREDS, async () => answer(404, {})).userInstallation('nobody')).toBeNull();
    await expect(githubApp(CREDS, fetchImpl).userInstallation('../app')).rejects.toThrow(/not a GitHub login/);
  });
});
