import { describe, expect, it } from 'vitest';
import { GITHUB_REFUSED } from '../keys/api-keys.service';
import { demoApiKeysView, demoGithubAppPort } from './demo';

// Settings › API keys in the demo (PRD 2433 s5): the keys' GitHub Apps, and an attach and a remove played in
// memory with the database's words, so the page plays as it will.

const PEM = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----\n';

describe('the demo’s GitHub Apps', () => {
  const view = demoApiKeysView();
  const [qa, digest] = view.kind === 'keys' ? view.keys : [];

  it('holds an App on the first key, with its last token, and none on the second', () => {
    expect(qa?.githubApp).toEqual({ slug: 'acme-fixer', lastTokenAt: '2026-10-14T08:00:00Z' });
    expect(digest?.githubApp).toBeNull();
  });

  it('attaches a pair that looks like one, and names the App after its ID', async () => {
    if (!digest) throw new Error('the demo holds no second key');
    expect(await demoGithubAppPort().attach(digest, '3141592', PEM)).toEqual({ ok: true, slug: 'demo-app-3141592' });
    expect(await demoGithubAppPort().attach(digest, ' 3141592 ', PEM)).toEqual({ ok: true, slug: 'demo-app-3141592' });
  });

  it('refuses an App ID that is not digits, or a file that is no private key, in GitHub’s words', async () => {
    if (!digest) throw new Error('the demo holds no second key');
    expect(await demoGithubAppPort().attach(digest, 'acme', PEM)).toEqual({ ok: false, message: GITHUB_REFUSED });
    expect(await demoGithubAppPort().attach(digest, '3141592', 'just some words')).toEqual({ ok: false, message: GITHUB_REFUSED });
  });

  it('removes the App of a key that held one, and says a key with none had nothing to remove', async () => {
    if (!qa || !digest) throw new Error('the demo holds no keys');
    expect(await demoGithubAppPort().remove(qa)).toEqual({ ok: true, removed: true });
    expect(await demoGithubAppPort().remove(digest)).toEqual({ ok: true, removed: false });
  });
});
