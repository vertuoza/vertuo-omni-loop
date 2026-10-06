import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GithubDeferred, GithubPaused, memoryGithubStore, type GithubStore } from '@omni/github';
import { repoReader } from './github';

vi.mock('server-only', () => ({}));

// The draft's GitHub reader against a stubbed fetch, never GitHub itself: the listing of a repository
// with and without the kit layout, and a file's text or null.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-09-30T12:00:00Z');
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\npaths:\n  delivery: loop/delivery\n';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function github(files: Record<string, unknown>, store: GithubStore | null = null) {
  const asked: string[] = [];
  const fetch = (raw: string, init: RequestInit) => {
    const url = new URL(raw);
    if (url.pathname === '/app/installations/11/access_tokens' && init.method === 'POST') {
      return Promise.resolve(json({ token: 'ghs_1', expires_at: new Date(NOW + 3_600_000).toISOString() }, 201));
    }
    asked.push(url.pathname);
    const etag = `"${url.pathname}"`;
    if (new Headers(init.headers).get('if-none-match') === etag) return Promise.resolve(new Response(null, { status: 304 }));
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer ghs_1');
    const found = files[url.pathname.replace('/repos/acme/widgets/contents/', '')];
    if (found === undefined) return Promise.resolve(json({ message: 'Not Found' }, 404));
    const headers = { etag };
    return Promise.resolve(typeof found === 'string' ? new Response(found, { headers }) : new Response(JSON.stringify(found), { headers }));
  };
  return { reader: repoReader(CREDS, fetch, () => NOW, store), asked };
}

describe('repoReader', () => {
  it('lists a repository with the kit layout: root files, docs and shipped folders', async () => {
    const { reader } = github({
      '': [{ name: 'README.md', type: 'file' }, { name: 'docs', type: 'dir' }],
      docs: [{ name: 'about.md', type: 'file' }, { name: 'img', type: 'dir' }],
      '.omni-loop/config.yml': CONFIG,
      'loop/delivery/shipped': [{ name: '0007-billing', type: 'dir' }, { name: '.gitkeep', type: 'file' }],
    });
    expect(await reader.listing(11, 'acme/widgets')).toEqual({
      root: ['README.md'], docs: ['about.md'], delivery: 'loop/delivery', shipped: ['0007-billing'],
    });
  });

  it('lists a repository without the kit layout or docs', async () => {
    const { reader, asked } = github({ '': [{ name: 'README.md', type: 'file' }] });
    expect(await reader.listing(11, 'acme/widgets')).toEqual({ root: ['README.md'], docs: [], delivery: null, shipped: [] });
    expect(asked).toHaveLength(3);
  });

  it('reads a file, or null when it is not there', async () => {
    const { reader } = github({ 'README.md': '# Widgets' });
    expect(await reader.file(11, 'acme/widgets', 'README.md')).toBe('# Widgets');
    expect(await reader.file(11, 'acme/widgets', 'docs/none.md')).toBeNull();
  });

  it('refuses a name that is not a repository', async () => {
    const { reader } = github({});
    await expect(reader.file(11, '../etc', 'passwd')).rejects.toThrow('is not a repository name');
  });
});

describe('repoReader and the budget (PRD 902, s6)', () => {
  const RESET = NOW + 30 * 60_000;

  it('reads in the background: below 20% of the installation\'s limit it sends nothing', async () => {
    const store = memoryGithubStore();
    await store.saveBudget(11, 'core', { limit: 5000, remaining: 999, resetAt: RESET, at: NOW });
    const { reader, asked } = github({ 'README.md': '# Widgets' }, store);
    await expect(reader.file(11, 'acme/widgets', 'README.md')).rejects.toBeInstanceOf(GithubDeferred);
    expect(asked).toEqual([]);
  });

  it('sends nothing while the installation is paused', async () => {
    const store = memoryGithubStore();
    await store.pause(11, 'core', RESET, NOW);
    const { reader, asked } = github({ 'README.md': '# Widgets' }, store);
    await expect(reader.listing(11, 'acme/widgets')).rejects.toBeInstanceOf(GithubPaused);
    expect(asked).toEqual([]);
  });

  it('asks again with the ETag it kept, and reads the kept text from a 304', async () => {
    const store = memoryGithubStore();
    const { reader, asked } = github({ 'README.md': '# Widgets' }, store);
    expect(await reader.file(11, 'acme/widgets', 'README.md')).toBe('# Widgets');
    expect(await reader.file(11, 'acme/widgets', 'README.md')).toBe('# Widgets');
    expect(asked).toHaveLength(2);
    expect((await store.etag(11, 'https://api.github.com/repos/acme/widgets/contents/README.md'))?.etag).toBe('"/repos/acme/widgets/contents/README.md"');
  });
});
