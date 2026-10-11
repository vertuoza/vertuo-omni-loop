// `omni product use <key>`, `omni product which` with a remembered product and `omni product phase0
// <repo>…` (PRD 1548, s11), through `main()` on a fixture repository with a stubbed Omni page: what each
// remembers, reads and prints, a worktree remembering for its main checkout, and each line it stops
// on. Nothing here calls the network.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const HOST = 'omni.test';
const CONFIG = `kit: 1
repo:
  slug: acme/app
ask:
  url: https://omni.test
`;
const NOW = new Date('2026-10-11T09:30:12Z');
const REMEMBERED = join('.omni-loop', 'local', 'product.json');

type Tokens = { access_token: string; refresh_token: string };
const signedIn = () => ({ read: (host: string): Tokens | null => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} });

/** A stub Omni page answering each call with what `reply` gives for its URL, keeping the URLs it was sent. */
function page(reply: (url: string) => { status: number; body: unknown }) {
  const sent: string[] = [];
  const fetch = (url: string) => {
    sent.push(url);
    const { status, body } = reply(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { sent, fetch };
}
const flags = (byRepo: Record<string, string>) =>
  page((url) => {
    const repo = new URL(url).searchParams.get('repo') ?? '';
    return byRepo[repo] ? { status: 200, body: { phase0: byRepo[repo] } } : { status: 404, body: { error: 'no such repository' } };
  });

async function run(root: string, args: string[], server = page(() => ({ status: 200, body: {} })), tokens = signedIn()) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['product', ...args], {
    cwd: root, env: {}, tokens, fetch: server.fetch, now: () => NOW,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}
const repo = (config = CONFIG) => makeRepo({ git: true, files: { '.omni-loop/config.yml': config } }).root;

describe('omni product use <key>', () => {
  it('remembers the product in .omni-loop/local/, with no Omni page call', async () => {
    const root = repo();
    const server = page(() => ({ status: 500, body: {} }));
    expect(await run(root, ['use', 'mobile'], server)).toEqual({ code: 0, out: 'product mobile remembered in this checkout\n', err: '' });
    expect(JSON.parse(readFileSync(join(root, REMEMBERED), 'utf8'))).toEqual({ key: 'mobile', usedAt: '2026-10-11T09:30:12.000Z' });
    expect(server.sent).toEqual([]);
  });

  it('remembers for the main checkout when run from one of its worktrees', async () => {
    const root = repo();
    execFileSync('git', ['commit', '--allow-empty', '-qm', 'base'], { cwd: root });
    const tree = join(root, '..', `${root.split('/').pop()}-tree`);
    execFileSync('git', ['worktree', 'add', '-q', tree], { cwd: root });
    expect((await run(tree, ['use', 'mobile'])).code).toBe(0);
    expect(existsSync(join(tree, REMEMBERED))).toBe(false);
    expect(JSON.parse(readFileSync(join(root, REMEMBERED), 'utf8')).key).toBe('mobile');
  });

  it('refuses a key that is not one, or none, exit 2, remembering nothing', async () => {
    const root = repo();
    for (const args of [['use', 'Mobile'], ['use', 'mobile-12'], ['use'], ['use', 'mobile', 'estimates'], ['use', '--product', 'mobile']]) {
      const { code, err } = await run(root, args);
      expect({ args, code }).toEqual({ args, code: 2 });
      expect(err).not.toBe('');
    }
    expect((await run(root, ['use', 'Mobile'])).err).toContain('not a product key: Mobile (lowercase kebab-case, as mobile)');
    expect(existsSync(join(root, REMEMBERED))).toBe(false);
  });
});

describe('omni product which', () => {
  it("prints the remembered product first, then this repository's products", async () => {
    const root = repo();
    await run(root, ['use', 'mobile']);
    const server = page(() => ({ status: 200, body: { products: [{ name: 'Mobile' }] } }));
    expect(await run(root, ['which'], server)).toEqual({ code: 0, out: 'remembered: mobile\nMobile\n', err: '' });
  });

  it('still prints the remembered product when the server is unreachable', async () => {
    const root = repo();
    await run(root, ['use', 'mobile']);
    const down = { sent: [], fetch: () => Promise.reject(new TypeError('fetch failed')) };
    expect(await run(root, ['which'], down)).toMatchObject({ code: 1, out: 'remembered: mobile\nno products read for acme/app: the server is unreachable\n' });
  });

  it('prints no remembered line when nothing is remembered', async () => {
    const server = page(() => ({ status: 200, body: { products: [] } }));
    expect(await run(repo(), ['which'], server)).toMatchObject({ code: 0, out: 'none\n' });
  });
});

describe('omni product phase0 <repo>…', () => {
  it("passes every target on server, reading each one's flag", async () => {
    const server = flags({ 'acme/api': 'server', 'acme/app': 'server' });
    expect(await run(repo(), ['phase0', 'acme/api', 'acme/app'], server)).toEqual({
      code: 0, out: 'acme/api is phase0: server\nacme/app is phase0: server\n', err: '',
    });
    expect(server.sent.map((url) => new URL(url).searchParams.get('repo'))).toEqual(['acme/api', 'acme/app']);
  });

  it('refuses a target on pr by name, and holds one whose flag cannot be read, exit 1', async () => {
    const server = flags({ 'acme/api': 'server', 'acme/web': 'pr' });
    expect(await run(repo(), ['phase0', 'acme/api', 'acme/web', 'acme/gone'], server)).toEqual({
      code: 1,
      out:
        'acme/api is phase0: server\n' +
        'acme/web is phase0: pr · switch it to server on its Omni page, or leave it out\n' +
        'acme/gone: its phase0 could not be read: refused (404)\n',
      err: '',
    });
  });

  it('says why with no sign-in, calling nothing', async () => {
    const server = flags({ 'acme/api': 'server' });
    const none = { read: () => null, write: () => {} };
    expect(await run(repo(), ['phase0', 'acme/api'], server, none)).toMatchObject({
      code: 1, out: 'acme/api: its phase0 could not be read: no sign-in (omni signin)\n',
    });
    expect(server.sent).toEqual([]);
  });

  it('refuses no repository or one that is not owner/name, exit 2', async () => {
    for (const args of [['phase0'], ['phase0', 'api'], ['phase0', 'acme/api', '--product', 'mobile']]) {
      expect((await run(repo(), args)).code, args.join(' ')).toBe(2);
    }
  });
});
