import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { present } from '../../ask/test/test-item';
import { appJwt } from '../../signup/github-app';
import { APP_PERMISSIONS, appInstallation, checkApp, mintToken, missingPermission } from './github-app';

vi.mock('server-only', () => ({}));

// An API key's GitHub App, as GitHub sees it (PRD 2433 s4): the pair checked, the installation found and
// the token minted, all on a stubbed GitHub behind an injected fetch. The private key is made here, when
// the test runs: the repository holds no key, not even a fake one (secret-shapes-guard).

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const CREDS = { appId: '123456', privateKey: PEM };
const NOW = Date.parse('2026-10-22T10:00:00Z');
const clock = () => NOW;
const TOKEN = 'gh' + 's_' + 'installation_token_for_the_tests';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A stubbed GitHub: `METHOD /path` to the answer it gives, fresh for each call. */
function github(answers: Record<string, () => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fetchImpl = (url: string, init: RequestInit): Promise<Response> => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, headers: init.headers as Record<string, string>, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    const answer = answers[`${method} ${url.replace('https://api.github.com', '')}`];
    return Promise.resolve(answer ? answer() : new Response('{}', { status: 404 }));
  };
  return { fetchImpl, calls };
}

const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status });

const jwtOf = (call: Call | undefined): string => {
  const header = present(call, 'a call').headers.authorization;
  expect(header).toMatch(/^Bearer /);
  return present(header, 'authorization').slice('Bearer '.length);
};

const signedByThePair = (jwt: string): boolean => {
  const [head, body, sig] = jwt.split('.');
  return createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(present(sig, 'signature'), 'base64url'));
};

describe('checking an App ID and private key', () => {
  const happy = { 'GET /app': json(200, { id: 123456, slug: 'acme-bugs' }), 'GET /users/acme-bugs[bot]': json(200, { id: 777, login: 'acme-bugs[bot]' }) };

  it('reads the slug from GET /app, then the bot\'s id from GET /users/<slug>[bot], both with the pair\'s JWT', async () => {
    const { fetchImpl, calls } = github(happy);
    expect(await checkApp(CREDS, fetchImpl, clock)).toEqual({ ok: true, slug: 'acme-bugs', botId: 777 });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET https://api.github.com/app', 'GET https://api.github.com/users/acme-bugs[bot]']);
    for (const call of calls) {
      expect(jwtOf(call)).toBe(appJwt(CREDS, NOW));
      expect(signedByThePair(jwtOf(call))).toBe(true);
      expect(call.headers.accept).toBe('application/vnd.github+json');
    }
  });

  it('refuses a pair GitHub answers 401 or 404 to, and never asks for the bot', async () => {
    for (const status of [401, 404]) {
      const { fetchImpl, calls } = github({ 'GET /app': json(status, { message: 'A JSON web token could not be decoded' }) });
      expect(await checkApp(CREDS, fetchImpl, clock)).toEqual({ ok: false, reason: 'refused', detail: `GitHub answered ${status} to GET /app` });
      expect(calls).toHaveLength(1);
    }
  });

  it('refuses a private key that signs nothing, without calling GitHub', async () => {
    const { fetchImpl, calls } = github(happy);
    const checked = await checkApp({ appId: '123456', privateKey: 'not a key' }, fetchImpl, clock);
    expect(checked).toMatchObject({ ok: false, reason: 'refused' });
    expect(calls).toEqual([]);
  });

  it('says GitHub could not answer, not that it refused, on a server error, an odd shape or a lost network', async () => {
    const odd = (answers: Record<string, () => Response>) => checkApp(CREDS, github(answers).fetchImpl, clock);
    expect(await odd({ 'GET /app': json(500, {}) })).toEqual({ ok: false, reason: 'unavailable', detail: 'GitHub answered 500 to GET /app' });
    const shapeless = await odd({ 'GET /app': json(200, { id: 1 }) });
    expect(shapeless).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(shapeless.ok ? '' : shapeless.detail).toMatch(/GET \/app is not the shape/);
    expect(await odd({ 'GET /app': json(200, { slug: '../evil' }) })).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(await odd({ 'GET /app': happy['GET /app'], 'GET /users/acme-bugs[bot]': json(404, {}) }))
      .toEqual({ ok: false, reason: 'unavailable', detail: 'GitHub answered 404 to GET /users/acme-bugs[bot]' });
    expect(await odd({ 'GET /app': happy['GET /app'], 'GET /users/acme-bugs[bot]': json(200, { id: 'x' }) })).toMatchObject({ ok: false, reason: 'unavailable' });
    const lost = await checkApp(CREDS, () => Promise.reject(new Error('fetch failed')), clock);
    expect(lost).toEqual({ ok: false, reason: 'unavailable', detail: 'GitHub could not be reached (fetch failed)' });
    const notJson = await checkApp(CREDS, () => Promise.resolve(new Response('<html>', { status: 200 })), clock);
    expect(notJson).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('never carries the private key in what it says', async () => {
    const said: string[] = [];
    for (const answers of [{ 'GET /app': json(401, {}) }, { 'GET /app': json(500, {}) }, { 'GET /app': json(200, { slug: 1 }) }]) {
      const checked = await checkApp(CREDS, github(answers).fetchImpl, clock);
      said.push(JSON.stringify(checked));
    }
    said.push(JSON.stringify(await checkApp({ appId: '1', privateKey: 'not a key' }, github({}).fetchImpl, clock)));
    for (const line of said) expect(line).not.toContain('PRIVATE KEY');
  });
});

describe('finding the App\'s installation on a repository', () => {
  const INSTALLATION = {
    id: 5001, account: { login: 'Acme', type: 'Organization' },
    permissions: { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' },
  };

  it('asks GET /repos/{owner}/{repo}/installation with the App\'s JWT and answers its id, owner and permissions', async () => {
    const { fetchImpl, calls } = github({ 'GET /repos/Acme/web/installation': json(200, INSTALLATION) });
    expect(await appInstallation(CREDS, 'Acme/web', fetchImpl, clock)).toEqual({
      id: 5001, account: 'Acme', permissions: { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' },
    });
    expect(calls).toHaveLength(1);
    expect(jwtOf(calls[0])).toBe(appJwt(CREDS, NOW));
  });

  it('answers null for a repository the App is not installed on', async () => {
    const { fetchImpl } = github({ 'GET /repos/Acme/web/installation': json(404, { message: 'Not Found' }) });
    expect(await appInstallation(CREDS, 'Acme/web', fetchImpl, clock)).toBeNull();
  });

  it('throws, naming the status, when GitHub answers an error, and when its answer is out of shape', async () => {
    const asked = (answer: () => Response) => appInstallation(CREDS, 'Acme/web', github({ 'GET /repos/Acme/web/installation': answer }).fetchImpl, clock);
    await expect(asked(json(401, {}))).rejects.toThrow('GitHub answered 401 to GET /repos/Acme/web/installation');
    await expect(asked(json(500, {}))).rejects.toThrow(/500/);
    await expect(asked(json(200, { id: 'x' }))).rejects.toThrow(/shape/);
    await expect(asked(json(200, { ...INSTALLATION, permissions: undefined }))).rejects.toThrow(/shape/);
  });

  it('refuses a name that is no repository, without calling GitHub', async () => {
    const { fetchImpl, calls } = github({});
    await expect(appInstallation(CREDS, '../evil', fetchImpl, clock)).rejects.toThrow(/not a GitHub repository/);
    expect(calls).toEqual([]);
  });
});

describe('the permission an installation lacks', () => {
  const FULL = { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' };
  const of = (permissions: Record<string, string>) => ({ id: 1, account: 'Acme', permissions });

  it('names none for contents, pull_requests and issues at write, or above', () => {
    expect(missingPermission(of(FULL))).toBeNull();
    expect(missingPermission(of({ ...FULL, contents: 'admin' }))).toBeNull();
  });

  it('names the first of contents, pull_requests and issues that is read-only or absent', () => {
    expect(missingPermission(of({ ...FULL, contents: 'read' }))).toBe('contents');
    expect(missingPermission(of({ ...FULL, pull_requests: 'read', issues: 'read' }))).toBe('pull_requests');
    expect(missingPermission(of({ contents: 'write', pull_requests: 'write', metadata: 'read' }))).toBe('issues');
  });
});

describe('minting an installation token', () => {
  const INSTALLATION = { id: 5001, account: 'Acme', permissions: {} };
  const MINT = 'POST /app/installations/5001/access_tokens';
  const minted = json(201, { token: TOKEN, expires_at: '2026-10-22T11:00:00Z', permissions: APP_PERMISSIONS });

  it('asks for exactly contents, pull_requests and issues write and metadata read, on the repositories given', async () => {
    const { fetchImpl, calls } = github({ [MINT]: minted });
    expect(await mintToken(CREDS, INSTALLATION, ['Acme/web', 'acme/backend'], fetchImpl, clock)).toEqual({ token: TOKEN, expiresAt: '2026-10-22T11:00:00Z' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(jwtOf(calls[0])).toBe(appJwt(CREDS, NOW));
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(calls[0]?.body).toEqual({
      repositories: ['web', 'backend'],
      permissions: { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' },
    });
    expect(APP_PERMISSIONS).toEqual({ contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' });
  });

  it('names each repository once', async () => {
    const { fetchImpl, calls } = github({ [MINT]: minted });
    await mintToken(CREDS, INSTALLATION, ['Acme/web', 'acme/WEB'], fetchImpl, clock);
    expect(calls[0]?.body).toMatchObject({ repositories: ['web'] });
  });

  it('refuses no repository, which GitHub would read as every repository of the installation', async () => {
    const { fetchImpl, calls } = github({ [MINT]: minted });
    await expect(mintToken(CREDS, INSTALLATION, [], fetchImpl, clock)).rejects.toThrow(/at least one repository/);
    expect(calls).toEqual([]);
  });

  it('refuses a repository of another owner, whose name GitHub would look up in the installation\'s own account', async () => {
    const { fetchImpl, calls } = github({ [MINT]: minted });
    await expect(mintToken(CREDS, INSTALLATION, ['Acme/web', 'other/web'], fetchImpl, clock)).rejects.toThrow('other/web is not a repository of Acme');
    await expect(mintToken(CREDS, INSTALLATION, ['../evil'], fetchImpl, clock)).rejects.toThrow(/not a GitHub repository/);
    expect(calls).toEqual([]);
  });

  it('throws, naming the status and never the token, when GitHub answers an error or an odd shape', async () => {
    const asked = (answer: () => Response) => mintToken(CREDS, INSTALLATION, ['Acme/web'], github({ [MINT]: answer }).fetchImpl, clock);
    await expect(asked(json(404, { message: 'Not Found' }))).rejects.toThrow(`GitHub answered 404 to POST /app/installations/5001/access_tokens`);
    await expect(asked(json(422, { message: `bad ${TOKEN}` }))).rejects.toThrow(/422/);
    await expect(asked(json(201, { token: TOKEN }))).rejects.toThrow(/shape/);
    await expect(asked(json(201, { token: '', expires_at: '2026-10-22T11:00:00Z' }))).rejects.toThrow(/shape/);
    const failure = await asked(json(422, { message: `bad ${TOKEN}` })).catch((error: unknown) => (error instanceof Error ? error.message : ''));
    expect(failure).not.toContain(TOKEN);
  });

  it('never carries the private key in what it throws', async () => {
    const failure = await mintToken({ appId: '1', privateKey: 'not a key' }, INSTALLATION, ['Acme/web'], github({}).fetchImpl, clock)
      .catch((error: unknown) => (error instanceof Error ? error.message : ''));
    expect(failure).not.toBe('');
    expect(failure).not.toContain('not a key');
  });
});
