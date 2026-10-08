// PRD 1218, slice s2: the base checks and fixes, each against a stubbed command runner and a stubbed
// repository — never the real machine.
import { describe, expect, it } from 'vitest';
import { PREREQUISITE_BASE_CHECKS, PREREQUISITE_BASE_FIXES } from '../grade.ts';
import type { RoadmapPrerequisite } from '../parse.ts';
import { BASE_CATALOG, probesFor } from './catalog.ts';
import type { PrereqEnv, ShellResult } from './catalog.ts';
import { CHECK_LIMIT_MS, FIX_LIMIT_MS } from './run.ts';

type Call = { line: string; cwd: string; timeoutMs: number };

/** A stubbed repository and command runner: `answers` by command line, `files` by path. */
function stub({ answers = {}, files = {}, labels = {}, signedIn = false }: {
  answers?: Record<string, Partial<ShellResult> | (() => Partial<ShellResult>)>;
  files?: Record<string, string>;
  labels?: Record<string, unknown>;
  signedIn?: boolean;
} = {}) {
  const calls: Call[] = [];
  const copies: [string, string][] = [];
  const tree = { ...files };
  const env: PrereqEnv = {
    root: '/repo',
    shell: (file, args, { cwd, timeoutMs }) => {
      const line = [file, ...args].join(' ');
      calls.push({ line, cwd, timeoutMs });
      const answer = answers[line];
      if (answer === undefined) return Promise.reject(new Error(`spawn ${file} ENOENT`));
      const given = typeof answer === 'function' ? answer() : answer;
      return Promise.resolve({ code: 0, stdout: '', stderr: '', ...given });
    },
    files: {
      exists: (path) => path in tree,
      read: (path) => tree[path] ?? null,
      copyNew: (from, to) => {
        if (to in tree || !(from in tree)) return false;
        tree[to] = tree[from] ?? '';
        copies.push([from, to]);
        return true;
      },
    },
    labels,
    signedIn: () => signedIn,
  };
  return { env, calls, copies, tree };
}

const check = (name: keyof typeof BASE_CATALOG, env: PrereqEnv) => BASE_CATALOG[name].check(env);
const fix = (name: keyof typeof BASE_CATALOG, env: PrereqEnv) => {
  const run = BASE_CATALOG[name].fix;
  if (!run) throw new Error(`${name} has no fix`);
  return run(env);
};

describe('the base catalog', () => {
  it('has an entry for each base check the grade knows, and a fix exactly for its base fixes', () => {
    expect(Object.keys(BASE_CATALOG).sort()).toEqual([...PREREQUISITE_BASE_CHECKS].sort());
    const fixes = Object.entries(BASE_CATALOG).filter(([, entry]) => entry.fix !== undefined).map(([name]) => name);
    expect(fixes.sort()).toEqual([...PREREQUISITE_BASE_FIXES].sort());
  });

  it('gives each base check a category and a card with its four lines', () => {
    for (const [name, entry] of Object.entries(BASE_CATALOG)) {
      expect(entry.category, name).toMatch(/^(local|access|permissions|github|services)$/);
      for (const line of [entry.card.why, entry.card.command, entry.card.whatItDoes, entry.card.whoCanDoIt]) {
        expect(line, name).toMatch(/\S/);
      }
    }
  });
});

describe('gh-auth', () => {
  it('is ok when gh is signed in with the repo scope', async () => {
    const { env } = stub({ answers: { 'gh auth status': { stdout: "  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'" } } });
    expect(await check('gh-auth', env)).toEqual({ ok: true });
  });

  it('is not ok without the repo scope, or signed out', async () => {
    const scopeless = stub({ answers: { 'gh auth status': { stderr: "  - Token scopes: 'gist', 'read:org'" } } });
    expect(await check('gh-auth', scopeless.env)).toEqual({ ok: false, detail: 'gh is signed in without the repo scope' });
    const out = stub({ answers: { 'gh auth status': { code: 1, stderr: 'You are not logged into any GitHub hosts.' } } });
    expect(await check('gh-auth', out.env)).toEqual({ ok: false, detail: 'gh is not signed in: You are not logged into any GitHub hosts.' });
  });

  it('runs within the check limit, in the repository', async () => {
    const { env, calls } = stub({ answers: { 'gh auth status': { stdout: "Token scopes: 'repo'" } } });
    await check('gh-auth', env);
    expect(calls).toEqual([{ line: 'gh auth status', cwd: '/repo', timeoutMs: CHECK_LIMIT_MS }]);
  });
});

describe('node', () => {
  it('is ok when node is at least the version package.json asks for', async () => {
    const { env } = stub({ answers: { 'node --version': { stdout: 'v22.4.1\n' } }, files: { 'package.json': JSON.stringify({ engines: { node: '>=20.11' } }) } });
    expect(await check('node', env)).toEqual({ ok: true });
  });

  it('is not ok when node is older than the version the repository names', async () => {
    const { env } = stub({ answers: { 'node --version': { stdout: 'v18.19.0' } }, files: { '.nvmrc': 'v20\n' } });
    expect(await check('node', env)).toEqual({ ok: false, detail: 'node is v18.19.0; the repository needs 20 or later' });
  });

  it('reads .node-version too, and compares minor and patch', async () => {
    const { env } = stub({ answers: { 'node --version': { stdout: 'v20.10.0' } }, files: { '.node-version': '20.11.1' } });
    expect(await check('node', env)).toEqual({ ok: false, detail: 'node is v20.10.0; the repository needs 20.11.1 or later' });
  });

  it('only asks node to answer when the repository names no version', async () => {
    const { env } = stub({ answers: { 'node --version': { stdout: 'v16.0.0' } } });
    expect(await check('node', env)).toEqual({ ok: true });
  });

  it('is not ok when node does not run', async () => {
    const { env } = stub();
    await expect(check('node', env)).rejects.toThrow('ENOENT');
  });
});

describe('the package managers', () => {
  it.each(['pnpm', 'npm', 'yarn'] as const)('%s is ok when it answers its version, and not ok when it fails', async (name) => {
    const good = stub({ answers: { [`${name} --version`]: { stdout: '9.15.9' } } });
    expect(await check(name, good.env)).toEqual({ ok: true });
    const bad = stub({ answers: { [`${name} --version`]: { code: 127, stderr: 'command not found' } } });
    expect(await check(name, bad.env)).toEqual({ ok: false, detail: `${name} --version exited 127: command not found` });
  });
});

describe('install', () => {
  it('is ok with the dependencies installed, and with nothing to install', async () => {
    expect(await check('install', stub({ files: { 'package.json': '{}', 'pnpm-lock.yaml': '', 'node_modules': '' } }).env)).toEqual({ ok: true });
    expect(await check('install', stub().env)).toEqual({ ok: true });
  });

  it('is not ok when the dependencies are not installed', async () => {
    const { env } = stub({ files: { 'package.json': '{}', 'pnpm-lock.yaml': '' } });
    expect(await check('install', env)).toEqual({ ok: false, detail: 'the dependencies are not installed' });
  });

  it.each([
    [{ 'pnpm-lock.yaml': '' }, 'pnpm install --frozen-lockfile'],
    [{ 'yarn.lock': '' }, 'yarn install --frozen-lockfile'],
    [{ 'package-lock.json': '' }, 'npm ci'],
    [{ 'package-lock.json': '' , 'package.json:pm': 'pnpm@9.15.9' }, 'pnpm install --frozen-lockfile'],
  ])('its fix installs from the lockfile with the repository\'s package manager (%o)', async (lock, line) => {
    const { 'package.json:pm': pm, ...lockfiles } = lock as Record<string, string>;
    const packageJson = JSON.stringify(pm === undefined ? {} : { packageManager: pm });
    const { env, calls } = stub({ files: { 'package.json': packageJson, ...lockfiles }, answers: { [line]: { code: 0 } } });
    expect(await fix('install', env)).toEqual({ ok: true });
    expect(calls).toEqual([{ line, cwd: '/repo', timeoutMs: FIX_LIMIT_MS }]);
  });

  it('its fix says what failed, and refuses without a lockfile', async () => {
    const failing = stub({ files: { 'package.json': '{}', 'pnpm-lock.yaml': '' }, answers: { 'pnpm install --frozen-lockfile': { code: 1, stderr: 'ERR_PNPM_FETCH_404\nnot found: @acme/ui' } } });
    expect(await fix('install', failing.env)).toEqual({ ok: false, detail: 'pnpm install --frozen-lockfile exited 1: not found: @acme/ui' });
    const unlocked = stub({ files: { 'package.json': '{}' } });
    expect(await fix('install', unlocked.env)).toEqual({ ok: false, detail: 'no lockfile to install from' });
    expect(unlocked.calls).toEqual([]);
  });
});

describe('registry', () => {
  it('pings the default registry when .npmrc names none', async () => {
    const { env, calls } = stub({ answers: { 'npm ping --registry https://registry.npmjs.org/': {} } });
    expect(await check('registry', env)).toEqual({ ok: true });
    expect(calls.map((call) => call.line)).toEqual(['npm ping --registry https://registry.npmjs.org/']);
  });

  it('pings every registry .npmrc names, scoped ones too, and names the one that does not answer', async () => {
    const npmrc = ['registry=https://registry.npmjs.org/', '@acme:registry=https://npm.acme.dev/', '//npm.acme.dev/:_authToken=${NPM_TOKEN}'].join('\n');
    const { env, calls } = stub({
      files: { '.npmrc': npmrc },
      answers: { 'npm ping --registry https://registry.npmjs.org/': {}, 'npm ping --registry https://npm.acme.dev/': { code: 1, stderr: 'E401' } },
    });
    expect(await check('registry', env)).toEqual({ ok: false, detail: 'the registry https://npm.acme.dev/ does not answer: E401' });
    expect(calls).toHaveLength(2);
  });
});

describe('docker', () => {
  it('is ok when docker info answers, and not ok when it does not', async () => {
    expect(await check('docker', stub({ answers: { 'docker info': {} } }).env)).toEqual({ ok: true });
    const down = stub({ answers: { 'docker info': { code: 1, stderr: 'Cannot connect to the Docker daemon' } } });
    expect(await check('docker', down.env)).toEqual({ ok: false, detail: 'docker info exited 1: Cannot connect to the Docker daemon' });
  });
});

describe('labels', () => {
  const labels = { prd: 'prd', feature: 'feature-pr', autoCreate: false };
  const list = 'gh label list --json name --limit 1000';

  it('is ok when every loop label exists, whatever its case', async () => {
    const { env } = stub({ labels, answers: { [list]: { stdout: JSON.stringify([{ name: 'PRD' }, { name: 'feature-pr' }, { name: 'bug' }]) } } });
    expect(await check('labels', env)).toEqual({ ok: true });
  });

  it('is not ok naming each missing label', async () => {
    const { env } = stub({ labels, answers: { [list]: { stdout: JSON.stringify([{ name: 'prd' }]) } } });
    expect(await check('labels', env)).toEqual({ ok: false, detail: 'missing labels: feature-pr' });
  });

  it('is not ok when the list cannot be read', async () => {
    const { env } = stub({ labels, answers: { [list]: { code: 1, stderr: 'HTTP 404' } } });
    expect(await check('labels', env)).toEqual({ ok: false, detail: `${list} exited 1: HTTP 404` });
  });

  it('its fix creates the missing labels only when labels.autoCreate is true', async () => {
    const off = stub({ labels, answers: { [list]: { stdout: '[]' } } });
    expect(await fix('labels', off.env)).toEqual({ ok: false, detail: 'labels.autoCreate is false: a person creates the labels' });
    expect(off.calls).toEqual([]);

    const create = 'gh label create feature-pr --color 0e8a16 --description Omni Loop: the feature pull request of a PRD';
    const on = stub({ labels: { ...labels, autoCreate: true }, answers: { [list]: { stdout: JSON.stringify([{ name: 'prd' }]) }, [create]: {} } });
    expect(await fix('labels', on.env)).toEqual({ ok: true });
    expect(on.calls.map((call) => call.line)).toEqual([list, create]);
  });

  it('its fix says which label it could not create', async () => {
    const create = 'gh label create feature-pr --color 0e8a16 --description Omni Loop: the feature pull request of a PRD';
    const { env } = stub({ labels: { ...labels, autoCreate: true }, answers: { [list]: { stdout: '[{"name":"prd"}]' }, [create]: { code: 1, stderr: 'HTTP 403' } } });
    expect(await fix('labels', env)).toEqual({ ok: false, detail: `${create} exited 1: HTTP 403` });
  });
});

describe('env-file', () => {
  const listing = 'git ls-files -- .env.example **/.env.example';

  it('is ok when each .env.example has its .env', async () => {
    const { env } = stub({ answers: { [listing]: { stdout: '.env.example\napps/web/.env.example\n' } }, files: { '.env.example': 'A=', '.env': 'A=1', 'apps/web/.env.example': 'B=', 'apps/web/.env': 'B=2' } });
    expect(await check('env-file', env)).toEqual({ ok: true });
  });

  it('is not ok naming each .env that is missing', async () => {
    const { env } = stub({ answers: { [listing]: { stdout: '.env.example\napps/web/.env.example\n' } }, files: { '.env.example': 'A=', '.env': 'A=1', 'apps/web/.env.example': 'B=' } });
    expect(await check('env-file', env)).toEqual({ ok: false, detail: 'missing: apps/web/.env' });
  });

  it('its fix copies each missing .env from its example, and never overwrites one', async () => {
    const { env, copies, tree } = stub({ answers: { [listing]: { stdout: '.env.example\napps/web/.env.example\n' } }, files: { '.env.example': 'A=', '.env': 'A=secret', 'apps/web/.env.example': 'B=' } });
    expect(await fix('env-file', env)).toEqual({ ok: true });
    expect(copies).toEqual([['apps/web/.env.example', 'apps/web/.env']]);
    expect(tree['.env']).toBe('A=secret');
  });

  it('its fix says which .env it could not write', async () => {
    const { env } = stub({ answers: { [listing]: { stdout: '.env.example\n' } }, files: { '.env.example': 'A=' } });
    env.files.copyNew = () => false;
    expect(await fix('env-file', env)).toEqual({ ok: false, detail: 'could not write: .env' });
  });
});

describe('omni-signin', () => {
  it('is ok when this machine is signed in to the Omni app, and not ok when not', async () => {
    expect(await check('omni-signin', stub({ signedIn: true }).env)).toEqual({ ok: true });
    expect(await check('omni-signin', stub({ signedIn: false }).env)).toEqual({ ok: false, detail: 'not signed in to the Omni app' });
  });
});

describe('probesFor', () => {
  const row = (over: Partial<RoadmapPrerequisite>): RoadmapPrerequisite => ({
    id: 'p1', category: 'local', need: 'n', check: null, fix: null, blocks: 'all', who: 'check', repos: null, card: null, ...over,
  });

  it('a base check runs the catalog\'s check, and a base fix its fix', async () => {
    const { env, calls } = stub({ answers: { 'docker info': {} } });
    const probes = probesFor(row({ check: 'base:docker' }), env);
    expect(await probes.check?.()).toEqual({ ok: true });
    expect(probes.fix).toBeNull();
    expect(calls.map((call) => call.line)).toEqual(['docker info']);
    const agent = probesFor(row({ who: 'agent', check: 'base:env-file', fix: 'base:env-file' }), env);
    await expect(agent.fix?.()).rejects.toThrow('spawn git ENOENT');
    expect(calls.at(-1)?.line).toBe('git ls-files -- .env.example **/.env.example');
  });

  it('a shell check runs through sh in the repository: ok on exit 0, else not ok with its last error line', async () => {
    const { env, calls } = stub({ answers: { 'sh -c npm view @acme/ui version': { code: 0 }, 'sh -c test -f x': { code: 1, stderr: 'first\nlast line\n' } } });
    expect(await probesFor(row({ check: 'npm view @acme/ui version' }), env).check?.()).toEqual({ ok: true });
    expect(await probesFor(row({ check: 'test -f x' }), env).check?.()).toEqual({ ok: false, detail: 'test -f x exited 1: last line' });
    expect(calls[0]).toEqual({ line: 'sh -c npm view @acme/ui version', cwd: '/repo', timeoutMs: CHECK_LIMIT_MS });
  });

  it('a shell command is never a fix, and an unknown base name checks as not ok', async () => {
    const { env, calls } = stub();
    expect(probesFor(row({ who: 'agent', check: 'base:docker', fix: 'rm -rf node_modules' }), env).fix).toBeNull();
    expect(probesFor(row({ who: 'agent', check: 'base:docker', fix: 'base:docker' }), env).fix).toBeNull();
    expect(await probesFor(row({ check: 'base:kubernetes' }), env).check?.()).toEqual({ ok: false, detail: 'base:kubernetes is no base check' });
    expect(calls).toEqual([]);
  });

  it('a row without a check has none', () => {
    expect(probesFor(row({}), stub().env)).toEqual({ check: null, fix: null });
  });
});
