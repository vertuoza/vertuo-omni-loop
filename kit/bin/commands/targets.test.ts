// `omni targets` (PRD 522, s1), through `main()` on a fixture repository with `gh` faked: the table in
// config order, `--json`, the exit code, and a repository with no plan section. It never calls GitHub.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { dig } from '../dig.ts';
import { main } from '../omni.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import { realExec } from '../../test/fixture.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const BUNDLE = 'var define_OMNI_BUNDLE_default = { home: "acme/kit", version: "0.0.40" };\n';
const FILLED = '---\nform: testing\nstate: filled\n---\n\n# Testing\n';
const WITH_LOOP = {
  '.omni-loop/config.yml': 'kit: 1\n',
  '.omni-loop/bin/omni.mjs': BUNDLE,
  '.omni-loop/knowledge/playbook/testing.md': FILLED,
};

const PLAN = `kit: 1
repo:
  slug: acme/plan
plan:
  guide: docs/git-repositories/README.md
  targets:
    - repo: acme/front
      role: front-end
      knowledge: own
    - repo: acme/legacy
      role: legacy
      knowledge: none
`;
const WITH_TYPO = `${PLAN}    - repo: acme/typo
      role: front-end
      knowledge: own
`;

/** A fake `execFileSync` answering `gh api` for the repositories of `world` (see targets.test.mjs). */
/** The repositories `gh` can read: each one's files, path to text. */
type World = Record<string, Record<string, string>>;

function fakeGh(world: World) {
  const calls: string[] = [];
  const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
    if (file === 'git') return realExec(file, args, options);
    if (file !== 'gh') throw new Error(`unexpected ${file}`);
    calls.push(args.join(' '));
    const endpoint = String(args[args.length - 1]);
    const [, owner, name, kind, ...rest] = String(endpoint.split('?')[0]).split('/');
    const repo = world[`${owner}/${name}`];
    if (!repo) throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
    if (kind === undefined) return JSON.stringify({ default_branch: 'main' });
    const path = rest.map(decodeURIComponent).join('/');
    if (Object.hasOwn(repo, path)) return String(repo[path]);
    const under = Object.keys(repo).filter((f) => f.startsWith(`${path}/`) && !f.slice(path.length + 1).includes('/'));
    if (under.length) return JSON.stringify(under.map((f) => ({ type: 'file', name: f.split('/').pop(), path: f })));
    throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
  };
  return { exec, calls };
}

async function targets(args: string[], { config, world = {} }: { config: string; world?: World }) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const { exec, calls } = fakeGh(world);
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['targets', ...args], { cwd: root, exec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), calls };
}

const ALL_OK = { 'acme/front': WITH_LOOP, 'acme/legacy': { 'README.md': 'hi' } };

describe('omni targets', () => {
  it('prints one row per target in config order, and exits 0 when every row is ok', async () => {
    const { code, out, err } = await targets([], { config: PLAN, world: ALL_OK });
    expect(err).toBe('');
    expect(out).toBe([
      'repo         role       knowledge  loop           state',
      'acme/front   front-end  own        v0.0.40        ok',
      'acme/legacy  legacy     none       not installed  ok',
      '',
    ].join('\n'));
    expect(code).toBe(0);
  });

  it('keeps a row gh cannot read, and exits 1 when a row is not ok', async () => {
    const { code, out } = await targets([], { config: WITH_TYPO, world: ALL_OK });
    expect(out.split('\n')[3]).toMatch(/^acme\/typo\s+front-end\s+own\s+—\s+unreachable \(gh: Not Found \(HTTP 404\)\)$/);
    expect(code).toBe(1);
  });

  it('prints the same rows as JSON with --json', async () => {
    const { code, out } = await targets(['--json'], { config: WITH_TYPO, world: ALL_OK });
    expect(JSON.parse(out)).toEqual([
      { repo: 'acme/front', role: 'front-end', knowledge: 'own', loop: 'v0.0.40', state: 'ok', detail: null },
      { repo: 'acme/legacy', role: 'legacy', knowledge: 'none', loop: 'not installed', state: 'ok', detail: null },
      { repo: 'acme/typo', role: 'front-end', knowledge: 'own', loop: '—', state: 'unreachable', detail: 'gh: Not Found (HTTP 404)' },
    ]);
    expect(code).toBe(1);
  });

  it('reads an imported target stale when its head changed an evidence file of its copy', async () => {
    const config = `${PLAN}    - repo: acme/back
      role: back-end
      knowledge: imported
      readAt: ${SHA}
`;
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': config,
        '.omni-loop/knowledge/repos/back/playbook/testing.md':
          '---\nform: testing\nform-version: 1\nstate: filled\npoints-to: null\nevidence:\n  - composer.json@50fa1bd\ninvaded: null\n---\n\n# Testing\n',
      },
    });
    const { exec } = fakeGh(ALL_OK);
    const faked = (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
      if (file === 'git') return realExec(file, args, options);
      const endpoint = String(args[args.length - 1]);
      if (endpoint === 'repos/acme/back') return JSON.stringify({ default_branch: 'main' });
      if (endpoint === `repos/acme/back/compare/${SHA}...main`) return JSON.stringify({ ahead_by: 3, files: [{ filename: 'composer.json' }] });
      if (endpoint.startsWith('repos/acme/back/')) throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
      return exec(file, args, options);
    };
    const out: string[] = [];
    const code = await main(['targets', '--json'], { cwd: root, exec: faked, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } });
    expect(dig(JSON.parse(out.join('')), 2)).toEqual({
      repo: 'acme/back', role: 'back-end', knowledge: 'imported', loop: 'not installed', state: 'stale', detail: '3 commits, 1 evidence file changed',
    });
    expect(code).toBe(1);
  });

  it("reads an imported target stale, naming the flow, when its committed flow is not its copy's (PRD 1089, s6)", async () => {
    const config = `${PLAN}    - repo: acme/back
      role: back-end
      knowledge: imported
      readAt: ${SHA}
`;
    const copied = "flow:\n  areas:\n    kernel:\n      paths: ['^src/kernel/']\n";
    const world = { ...ALL_OK, 'acme/back': { '.omni-loop/config.yml': `kit: 1\n${copied.replace('kernel/', 'core/')}` } };
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, '.omni-loop/knowledge/repos/back/flow/config.yml': copied } });
    const { exec } = fakeGh(world);
    const faked = (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
      const endpoint = String(args[args.length - 1]);
      if (endpoint === `repos/acme/back/compare/${SHA}...main`) return JSON.stringify({ ahead_by: 1, files: [{ filename: '.omni-loop/config.yml' }] });
      return exec(file, args, options);
    };
    const out: string[] = [];
    const code = await main(['targets'], { cwd: root, exec: faked, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } });
    expect(out.join('').split('\n')[3]).toMatch(
      new RegExp(`^acme/back\\s+back-end\\s+imported\\s+installed\\s+stale \\(flow moved since read at ${SHA.slice(0, 7)}: its flow section differs from the copy\\)$`),
    );
    expect(code).toBe(1);
  });

  it('says not a plan repository, exit 1, when the config has no plan section, and asks GitHub nothing', async () => {
    for (const args of [[], ['--json']]) {
      const { code, out, calls } = await targets(args, { config: 'kit: 1\nrepo:\n  slug: acme/widgets\n' });
      expect(out).toBe('not a plan repository\n');
      expect(code).toBe(1);
      expect(calls).toEqual([]);
    }
  });

  it('has its entry in omni help targets', async () => {
    const out: string[] = [];
    const code = await main(['help', 'targets'], { cwd: makeRepo({ git: true, files: { '.omni-loop/config.yml': PLAN } }).root, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } });
    expect(code).toBe(0);
    expect(out.join('')).toMatch(/omni targets \[--json\]/);
    expect(out.join('')).toMatch(/not a plan repository/);
  });

  it('refuses an argument or a flag it does not take, exit 2', async () => {
    expect((await targets(['acme/front'], { config: PLAN, world: ALL_OK })).code).toBe(2);
    expect((await targets(['--fetch'], { config: PLAN, world: ALL_OK })).code).toBe(2);
  });
});

describe('omni targets with plan.product (PRD 1364, s4)', () => {
  const HOST = 'omni.test';
  const PRODUCT_PLAN = (url = 'https://omni.test') => `kit: 1\nrepo:\n  slug: acme/plan\nask:\n  url: ${url}\nplan:\n  guide: null\n  product: Mobile\n`;
  const LINKS = {
    product: { name: 'Mobile' },
    targets: [
      { repo: 'acme/front', role: 'front-end', knowledge: 'own', readAt: null, readOnly: false, consumes: ['acme/legacy'] },
      { repo: 'acme/legacy', role: 'legacy', knowledge: 'none', readAt: null, readOnly: true, consumes: [] },
    ],
  };
  const TABLE = [
    'repo         role       knowledge  loop           state',
    'acme/front   front-end  own        v0.0.40        ok',
    'acme/legacy  legacy     none       not installed  ok',
  ];
  type Tokens = { access_token: string; refresh_token: string };
  const signedIn = () => ({ read: (host: string): Tokens | null => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} });
  const answering = (status: number, body: unknown) => {
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    };
    return { urls, fetch };
  };
  const down = { fetch: () => Promise.reject(new TypeError('fetch failed')) };

  async function run(root: string, args: string[], server: { fetch: unknown }, tokens: unknown = signedIn()) {
    const out: string[] = [];
    const err: string[] = [];
    const { exec } = fakeGh(ALL_OK);
    const code = await main(['targets', ...args], {
      cwd: root, exec, env: {}, tokens, fetch: server.fetch, now: () => new Date('2026-10-10T09:30:00Z'),
      stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
    });
    return { code, out: out.join(''), err: err.join('') };
  }
  const checkout = (config = PRODUCT_PLAN()) => makeRepo({ git: true, files: { '.omni-loop/config.yml': config } }).root;

  it("prints the product's links as the targets table, read from the server, and keeps the read", async () => {
    const root = checkout();
    const server = answering(200, LINKS);
    expect(await run(root, [], server)).toEqual({ code: 0, out: `${TABLE.join('\n')}\n`, err: '' });
    expect(server.urls).toEqual(['https://omni.test/api/products/targets?repo=acme%2Fplan&product=Mobile']);
    expect(JSON.parse(readFileSync(join(root, '.omni-loop/local/product-targets.json'), 'utf8'))).toMatchObject({
      product: 'Mobile',
      readAt: '2026-10-10T09:30:00.000Z',
      targets: [{ repo: 'acme/front', consumes: ['legacy'] }, { repo: 'acme/legacy', readOnly: true }],
    });
  });

  it('reads the last copy when the server is unreachable, saying so first', async () => {
    const root = checkout();
    await run(root, [], answering(200, LINKS));
    expect(await run(root, [], down)).toEqual({
      code: 0,
      out: ['targets from the last read, 2026-10-10 09:30 UTC · server unreachable', ...TABLE, ''].join('\n'),
      err: '',
    });
    const json = await run(root, ['--json'], down);
    expect(json.err).toBe('targets from the last read, 2026-10-10 09:30 UTC · server unreachable\n');
    expect(JSON.parse(json.out)).toHaveLength(2);
  });

  it('stops when the server is unreachable and nothing was read yet', async () => {
    expect(await run(checkout(), [], down)).toEqual({ code: 1, out: 'no targets: the server is unreachable and nothing was read yet\n', err: '' });
  });

  it('refuses a link with no role, by name', async () => {
    const noRole = { ...LINKS, targets: [{ ...LINKS.targets[0], role: null }] };
    expect(await run(checkout(), [], answering(200, noRole))).toEqual({
      code: 1,
      out: 'acme/front has no role in product Mobile: set it on the product page\n',
      err: '',
    });
  });

  it("stops on the server's refusal, with its reason", async () => {
    expect((await run(checkout(), [], answering(404, { error: 'No product Mobile in the workspace of acme/plan.' }))).out).toBe(
      'the server refused the targets of product Mobile (404): No product Mobile in the workspace of acme/plan.\n',
    );
  });

  it('needs an Omni page and a sign-in for it', async () => {
    const noPage = PRODUCT_PLAN().replace('url: https://omni.test', 'url: null');
    expect(await run(checkout(noPage), [], down)).toEqual({
      code: 1,
      out: 'no targets: plan.product reads them from the Omni page, and ask.url is not set\n',
      err: '',
    });
    expect(await run(checkout(), [], down, { read: () => null, write: () => {} })).toEqual({
      code: 1,
      out: 'no targets: no sign-in for omni.test (omni signin)\n',
      err: '',
    });
  });
});
