// `omni kb pack get <repo>` through `main()` against a fake server (PRD 2011, s12): the route it calls,
// the folder it prints, held mode with the server down, a 404 for another workspace's repository, and
// `pack stale` against the link's read_at (`--read-at`). `gh` is a fake; nothing calls the network.
import type { ExecFileSyncOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { main } from '../../../bin/omni.ts';
import { makeRepo, realExec } from '../../../test/fixture.ts';

const HOST = 'omni.test';
const SHA = 'a'.repeat(40);
const READ_AT = 'b'.repeat(40);
const CONFIG = 'kit: 1\n';
const PACK = {
  repository: 'acme/back',
  sha: SHA,
  committedAt: '2026-10-15T00:00:00Z',
  madeAt: '2026-10-15T00:01:00Z',
  files: [{ path: '.omni-loop/config.yml', sha256: createHash('sha256').update(CONFIG).digest('hex'), content: CONFIG }],
};
const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };

/** `gh` answers a compare with `status`; `git` is the real one. */
const gh = (status: string | null) => (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
  if (file === 'git') return realExec(file, args, options);
  if (status === null) throw new Error('gh: could not resolve to a Repository');
  return JSON.stringify({ status, ahead_by: 0 });
};

async function omni(argv: string[], fetch: (url: string) => Promise<Response>, root: string, compare: string | null = null) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    cwd: root,
    exec: gh(compare),
    env: {},
    tokens: signedIn,
    fetch,
    now: () => new Date('2026-10-16T12:00:00Z'),
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}

const files = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/plan\nask:\n  url: https://omni.test\n' };
const served = () => Promise.resolve(new Response(JSON.stringify(PACK)));

describe('omni kb pack get', () => {
  it('reads the route as the caller, prints the folder, then holds on it with the server down', async () => {
    const { root } = makeRepo({ git: true, files });
    const urls: string[] = [];
    const up = (url: string) => {
      urls.push(url);
      return served();
    };
    const first = await omni(['kb', 'pack', 'get', 'back'], up, root);
    expect(urls).toEqual(['https://omni.test/api/knowledge-packs?repo=acme%2Fback']);
    expect(first.code).toBe(0);
    expect(first.out).toMatch(new RegExp(`/\\.omni-loop/local/packs/back@${SHA}\\n$`));
    const held = await omni(['kb', 'pack', 'get', 'acme/back'], () => Promise.reject(new TypeError('fetch failed')), root);
    expect(held.code).toBe(0);
    expect(held.out).toContain(`held · server unreachable · newest pack fetched: ${SHA} · 1d old`);
  });

  it("gets a 404 for another workspace's repository, and no folder", async () => {
    const { root } = makeRepo({ git: true, files });
    const result = await omni(['kb', 'pack', 'get', 'acme/theirs'], () => Promise.resolve(new Response(JSON.stringify({ error: 'no pack' }), { status: 404 })), root);
    expect(result.code).toBe(1);
    expect(result.out).toBe('');
    expect(result.err).toContain('(404): no pack');
  });

  it('stops with pack stale when GitHub says the pack is behind read_at', async () => {
    const { root } = makeRepo({ git: true, files });
    const result = await omni(['kb', 'pack', 'get', 'back', '--read-at', READ_AT], served, root, 'behind');
    expect(result).toEqual({ code: 1, out: '', err: `pack stale: ${SHA.slice(0, 7)} < read_at ${READ_AT.slice(0, 7)}\n` });
  });

  it('serves a pack at or past read_at, and says when the two cannot be compared', async () => {
    const { root } = makeRepo({ git: true, files });
    expect((await omni(['kb', 'pack', 'get', 'back', '--read-at', READ_AT], served, root, 'ahead')).code).toBe(0);
    const unknown = await omni(['kb', 'pack', 'get', 'back', '--read-at', READ_AT], served, root, null);
    expect(unknown.code).toBe(0);
    expect(unknown.err).toContain('could not be compared');
  });
});
