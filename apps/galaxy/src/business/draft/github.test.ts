import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { repoReader } from './github';

// The draft's GitHub reader against a stubbed fetch, never GitHub itself: the listing of a repository
// with and without the kit layout, and a file's text or null.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-09-30T12:00:00Z');
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\npaths:\n  delivery: loop/delivery\n';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function github(files: Record<string, unknown>) {
  const asked: string[] = [];
  const fetch = async (raw: string, init: RequestInit) => {
    const url = new URL(raw);
    if (url.pathname === '/app/installations/11/access_tokens' && init.method === 'POST') {
      return json({ token: 'ghs_1', expires_at: new Date(NOW + 3_600_000).toISOString() }, 201);
    }
    asked.push(url.pathname);
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer ghs_1');
    const found = files[url.pathname.replace('/repos/acme/widgets/contents/', '')];
    if (found === undefined) return json({ message: 'Not Found' }, 404);
    return typeof found === 'string' ? new Response(found) : json(found);
  };
  return { reader: repoReader(CREDS, fetch, () => NOW), asked };
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
