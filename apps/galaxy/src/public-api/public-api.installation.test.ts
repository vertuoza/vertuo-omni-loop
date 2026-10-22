import { createVerify, generateKeyPairSync, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { present } from '../ask/test/test-item';
import { sealSecret } from '../jev/secret-box';
import { appJwt } from '../signup/github-app';
import { installationChecker } from './public-api.installation';

vi.mock('server-only', () => ({}));

// Asking GitHub about a key's App on a repository (PRD 2433 s6): the sealed private key opened under the
// master key, the App's own JWT on GET /repos/{owner}/{repo}/installation, and the answer read as the
// service reads it. GitHub is a stub behind an injected fetch; the private key is made here, when the test
// runs (the repository holds no key, not even a fake one: secret-shapes-guard).

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const MASTER = randomBytes(32);
const NOW = Date.parse('2026-10-22T10:00:00Z');
const PATH = '/repos/acme/backend/installation';

const sealed = sealSecret(PEM, MASTER);
const APP = { appId: 123456, slug: 'acme-bot', ciphertext: sealed.ciphertext, iv: sealed.iv };

type Call = { url: string; method: string; authorization: string | undefined };

/** A stubbed GitHub that answers the installation route with `answer`, and records each call. */
function github(answer: () => Response) {
  const calls: Call[] = [];
  const fetchImpl = (url: string, init: RequestInit): Promise<Response> => {
    const headers = init.headers as Record<string, string>;
    calls.push({ url, method: init.method ?? 'GET', authorization: headers.authorization });
    return Promise.resolve(url === `https://api.github.com${PATH}` ? answer() : new Response('{}', { status: 404 }));
  };
  return { fetchImpl, calls };
}

const installed = (permissions: Record<string, string>) => () =>
  new Response(JSON.stringify({ id: 4242, account: { login: 'acme' }, permissions }), { status: 200 });

const ALL = { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' };

describe('asking GitHub about a key’s App on a repository', () => {
  it('opens the sealed key, signs as the App, and asks for the repository’s installation once', async () => {
    const { fetchImpl, calls } = github(installed(ALL));
    const check = installationChecker(() => MASTER, fetchImpl, () => NOW);
    expect(await check(APP, 'acme/backend')).toEqual({ installed: true, missing: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'GET', url: `https://api.github.com${PATH}` });
    const jwt = present(calls[0]?.authorization, 'authorization').slice('Bearer '.length);
    expect(jwt).toBe(appJwt({ appId: '123456', privateKey: PEM }, NOW));
    const [head, body, sig] = jwt.split('.');
    expect(createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(present(sig, 'signature'), 'base64url'))).toBe(true);
  });

  it('says not installed when GitHub knows no installation on the repository', async () => {
    const { fetchImpl } = github(() => new Response('{"message":"Not Found"}', { status: 404 }));
    expect(await installationChecker(() => MASTER, fetchImpl, () => NOW)(APP, 'acme/backend')).toEqual({ installed: false });
  });

  it('names the first of contents, pull_requests and issues the installation holds no write access to', async () => {
    const asked = (permissions: Record<string, string>) =>
      installationChecker(() => MASTER, github(installed(permissions)).fetchImpl, () => NOW)(APP, 'acme/backend');
    expect(await asked({ ...ALL, contents: 'read' })).toEqual({ installed: true, missing: 'contents' });
    expect(await asked({ contents: 'write', metadata: 'read' })).toEqual({ installed: true, missing: 'pull_requests' });
    expect(await asked({ contents: 'write', pull_requests: 'write', metadata: 'read' })).toEqual({ installed: true, missing: 'issues' });
    expect(await asked({ ...ALL, contents: 'admin' })).toEqual({ installed: true, missing: null });
  });

  it('asks nothing of GitHub, and throws, when the deployment has no master key', async () => {
    const { fetchImpl, calls } = github(installed(ALL));
    await expect(installationChecker(() => null, fetchImpl, () => NOW)(APP, 'acme/backend')).rejects.toThrow('SECRETS_MASTER_KEY');
    expect(calls).toEqual([]);
  });

  it('asks nothing of GitHub, and throws without the key’s words, when the master key is not the one that sealed it', async () => {
    const { fetchImpl, calls } = github(installed(ALL));
    const error = await installationChecker(() => randomBytes(32), fetchImpl, () => NOW)(APP, 'acme/backend').then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(calls).toEqual([]);
    const message = error instanceof Error ? error.message : '';
    expect(message).not.toContain(sealed.ciphertext);
    expect(message).not.toContain('PRIVATE KEY');
  });

  it('throws, naming GitHub’s status and the path and never the key, when GitHub fails', async () => {
    const { fetchImpl } = github(() => new Response('{"message":"Bad credentials"}', { status: 500 }));
    const error = await installationChecker(() => MASTER, fetchImpl, () => NOW)(APP, 'acme/backend').then(() => null, (e: unknown) => e);
    expect(error instanceof Error ? error.message : null).toBe(`GitHub answered 500 to GET ${PATH}`);
  });
});
