import { describe, expect, it } from 'vitest';
import { COULD_NOT, httpApiKeysPort, httpGithubAppPort } from './api-keys.client';

// Settings › API keys' calls from the browser (PRD 2022 s1): what each sends, and what it makes of each
// answer.

const WS = '11111111-1111-4111-8111-111111111111';
const KEY = {
  id: 'k-1', name: 'QA dashboard', lastFour: '9fQe', repos: [], createdAt: '2026-10-15T10:00:00Z', lastUsedAt: null, revokedAt: null,
  maker: { id: 'u-1', login: 'ada', name: null }, working: true,
};
const SECRET = `oma_${'A'.repeat(39)}9fQe`;

function answering(status: number, body: unknown) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fetch = ((url: string, init: RequestInit) => {
    sent.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof globalThis.fetch;
  return { fetch, sent };
}

describe('the browser’s API keys port', () => {
  it('makes a key with its name and repositories, and reads the secret and the key back', async () => {
    const { fetch, sent } = answering(201, { secret: SECRET, key: KEY });
    expect(await httpApiKeysPort(WS, fetch).make('QA dashboard', ['northwind/backend'])).toEqual({ ok: true, secret: SECRET, key: KEY });
    expect(sent[0]?.url).toBe('/api/api-keys');
    expect(sent[0]?.init.method).toBe('POST');
    expect(JSON.parse(sent[0]?.init.body as string)).toEqual({ workspace: WS, name: 'QA dashboard', repos: ['northwind/backend'] });
  });

  it('revokes a key by its id', async () => {
    const revoked = { ...KEY, revokedAt: '2026-10-15T11:00:00Z' };
    const { fetch, sent } = answering(200, { key: revoked });
    expect(await httpApiKeysPort(WS, fetch).revoke(KEY)).toEqual({ ok: true, key: revoked });
    expect(sent[0]?.init.method).toBe('DELETE');
    expect(JSON.parse(sent[0]?.init.body as string)).toEqual({ workspace: WS, key: 'k-1' });
  });

  it('says a refusal in the route’s words, and anything else in its own', async () => {
    expect(await httpApiKeysPort(WS, answering(403, { error: 'Only an owner.' }).fetch).make('x', [])).toEqual({ ok: false, message: 'Only an owner.' });
    expect(await httpApiKeysPort(WS, answering(500, 'oops').fetch).revoke(KEY)).toEqual({ ok: false, message: COULD_NOT });
    expect(await httpApiKeysPort(WS, answering(201, { secret: 'nope', key: KEY }).fetch).make('x', [])).toEqual({ ok: false, message: COULD_NOT });
    const failing = (() => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch;
    expect(await httpApiKeysPort(WS, failing).make('x', [])).toEqual({ ok: false, message: COULD_NOT });
  });
});

// A key's GitHub App from the browser (PRD 2433 s4): the owner's attach (and replace) and remove.
describe('the browser’s GitHub App port', () => {
  it('attaches an App to a key by its id, sending the App ID and the private key, and reads the slug back', async () => {
    const { fetch, sent } = answering(200, { slug: 'acme-bugs' });
    expect(await httpGithubAppPort(fetch).attach(KEY, ' 123456 ', 'the pem')).toEqual({ ok: true, slug: 'acme-bugs' });
    expect(sent[0]?.url).toBe('/api/api-keys/k-1/github-app');
    expect(sent[0]?.init.method).toBe('POST');
    expect(JSON.parse(sent[0]?.init.body as string)).toEqual({ appId: '123456', privateKey: 'the pem' });
  });

  it('removes the App of a key by its id, and reads whether it held one', async () => {
    const { fetch, sent } = answering(200, { removed: true });
    expect(await httpGithubAppPort(fetch).remove(KEY)).toEqual({ ok: true, removed: true });
    expect(sent[0]?.url).toBe('/api/api-keys/k-1/github-app');
    expect(sent[0]?.init.method).toBe('DELETE');
    expect(sent[0]?.init.body).toBeUndefined();
  });

  it('says a refusal in the route’s words, and anything else in its own', async () => {
    const refused = answering(422, { error: 'GitHub refused this App ID and private key.' });
    expect(await httpGithubAppPort(refused.fetch).attach(KEY, '1', 'x')).toEqual({ ok: false, message: 'GitHub refused this App ID and private key.' });
    expect(await httpGithubAppPort(answering(500, 'oops').fetch).remove(KEY)).toEqual({ ok: false, message: COULD_NOT });
    expect(await httpGithubAppPort(answering(200, { slug: 3 }).fetch).attach(KEY, '1', 'x')).toEqual({ ok: false, message: COULD_NOT });
    expect(await httpGithubAppPort(answering(200, {}).fetch).remove(KEY)).toEqual({ ok: false, message: COULD_NOT });
    const failing = (() => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch;
    expect(await httpGithubAppPort(failing).attach(KEY, '1', 'x')).toEqual({ ok: false, message: COULD_NOT });
  });
});
