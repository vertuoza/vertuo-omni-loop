// The Vercel ignore step of both projects (PRD 1646, after PRD 675). Each case runs the script in a
// fixture git repository, as Vercel's clone is, carrying the script and scripts/vercel-inputs.ts, with
// GitHub's commit statuses served by a local stub. Exit 0 skips the build, exit 1 builds.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { digText } from '../kit/bin/dig.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dirs: string[] = [];

/** sha → the contexts whose status is success. `unreachable` makes the stub answer 500. */
const statuses = new Map<string, string[]>();
let unreachable = false;
let server: Server;
let api = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const sha = /\/commits\/([0-9a-f]+)\/status/.exec(req.url ?? '')?.[1] ?? '';
    if (unreachable || req.headers.authorization !== 'Bearer token') {
      res.writeHead(500).end();
      return;
    }
    const list = (statuses.get(sha) ?? []).map((context) => ({ context, state: 'success' }));
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ statuses: list }));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  api = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
});

afterAll(() => new Promise<void>((done) => server.close(() => { done(); })));

afterEach(() => {
  statuses.clear();
  unreachable = false;
  while (dirs.length) rmSync(dirs.pop() ?? '', { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' }).stdout.trim();

function write(root: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

/** A repository whose first commit carries the scripts and a package.json at version 1. */
function repo(): { root: string; commit: (message: string, files: Record<string, string>) => string } {
  const root = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
  dirs.push(root);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 't');
  mkdirSync(join(root, 'scripts'));
  copyFileSync(join(here, 'vercel-ignore.sh'), join(root, 'scripts/vercel-ignore.sh'));
  copyFileSync(join(here, 'vercel-inputs.ts'), join(root, 'scripts/vercel-inputs.ts'));
  const commit = (message: string, files: Record<string, string>) => {
    write(root, files);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  commit('init', { 'package.json': '{\n  "name": "x",\n  "version": "1"\n}\n' });
  return { root, commit };
}

interface Run { status: number | null; stdout: string }

function ignore(root: string, project: string, env: Record<string, string>): Promise<Run> {
  return new Promise((done) => {
    const child = spawn('bash', ['scripts/vercel-ignore.sh', project], {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        VERCEL_GIT_REPO_OWNER: 'acme',
        VERCEL_GIT_REPO_SLUG: 'widgets',
        GITHUB_STATUS_TOKEN: 'token',
        VERCEL_IGNORE_GITHUB_API: api,
        ...env,
      },
    });
    let stdout = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.on('close', (status) => { done({ status, stdout }); });
  });
}

const BUILD = 1;
const SKIP = 0;
const RELEASE = 'chore(release): v0.0.2';
const bump = { 'package.json': '{\n  "name": "x",\n  "version": "2"\n}\n' };

describe('on main', () => {
  it('skips a merge commit: its release commit carries it', async () => {
    const { root, commit } = repo();
    const sha = commit('feat(galaxy): a thing (#1)', { 'apps/galaxy/a.ts': 'x' });
    for (const project of ['galaxy', 'omni-app']) {
      const run = await ignore(root, project, { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: 'feat(galaxy): a thing (#1)' });
      expect(run.status).toBe(SKIP);
      expect(run.stdout).toMatch(/is a merge/);
    }
  });

  it('builds a release commit only for the projects whose inputs changed since their last deploy', async () => {
    const { root, commit } = repo();
    const previous = git(root, 'rev-parse', 'HEAD');
    commit('feat(galaxy): a thing (#1)', { 'apps/galaxy/a.ts': 'x' });
    const sha = commit(RELEASE, bump);
    const env = { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: RELEASE, VERCEL_GIT_PREVIOUS_SHA: previous };
    expect((await ignore(root, 'galaxy', env)).status).toBe(BUILD);
    expect((await ignore(root, 'omni-app', env)).status).toBe(SKIP);
  });

  it('builds only omni-app at the release commit of an omni-app merge', async () => {
    const { root, commit } = repo();
    const previous = git(root, 'rev-parse', 'HEAD');
    commit('fix(omni-app): a thing (#2)', { 'apps/omni-app/src/a.ts': 'x' });
    const sha = commit(RELEASE, bump);
    const env = { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: RELEASE, VERCEL_GIT_PREVIOUS_SHA: previous };
    expect((await ignore(root, 'omni-app', env)).status).toBe(BUILD);
    expect((await ignore(root, 'galaxy', env)).status).toBe(SKIP);
  });

  it('builds neither project for a phase-0 or retro merge and its release commit', async () => {
    const { root, commit } = repo();
    const previous = git(root, 'rev-parse', 'HEAD');
    commit('docs(phase-0): x (#3)', { '.omni-loop/delivery/inbox/0003-x/spec.md': 'x' });
    const sha = commit(RELEASE, { ...bump, 'kit/dist/omni.mjs': 'v2' });
    const env = { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: RELEASE, VERCEL_GIT_PREVIOUS_SHA: previous };
    // The release commit stamps only the version: galaxy's sidebar lags until the next code merge.
    expect((await ignore(root, 'omni-app', env)).status).toBe(SKIP);
    expect((await ignore(root, 'galaxy', env)).status).toBe(SKIP);
  });

  it('builds when unsure: no previous SHA, one the clone lacks, an empty message', async () => {
    const { root, commit } = repo();
    const sha = commit(RELEASE, bump);
    const base = { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: RELEASE };
    expect((await ignore(root, 'omni-app', base)).status).toBe(BUILD);
    expect((await ignore(root, 'omni-app', { ...base, VERCEL_GIT_PREVIOUS_SHA: 'f'.repeat(40) })).stdout).toMatch(/not in the clone, building/);
    expect((await ignore(root, 'omni-app', { ...base, VERCEL_GIT_COMMIT_MESSAGE: '' })).status).toBe(BUILD);
  });

  it('deepens a shallow clone once to find the previous deploy', async () => {
    const { root, commit } = repo();
    const previous = git(root, 'rev-parse', 'HEAD');
    commit('docs: x', { 'docs/superpowers/a.md': 'x' });
    commit('docs: y', { 'docs/superpowers/b.md': 'y' });
    const sha = commit(RELEASE, { '.github/workflows/x.yml': 'x' });
    const clone = mkdtempSync(join(tmpdir(), 'vercel-ignore-clone-'));
    dirs.push(clone);
    spawnSync('git', ['clone', '-q', '--depth', '1', `file://${root}`, clone]);
    expect(spawnSync('git', ['cat-file', '-e', previous], { cwd: clone }).status).not.toBe(0);
    const run = await ignore(clone, 'galaxy', { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: RELEASE, VERCEL_GIT_PREVIOUS_SHA: previous });
    expect(run.stdout).toMatch(/nothing since .* reaches galaxy, skipping/);
    expect(run.status).toBe(SKIP);
  });

  it('builds a merge commit the release workflow\'s fallback marked', async () => {
    const { root, commit } = repo();
    const sha = commit('feat: x (#4)', { 'apps/galaxy/a.ts': 'x' });
    statuses.set(sha, ['vercel/production-fallback']);
    const run = await ignore(root, 'omni-app', { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_GIT_COMMIT_MESSAGE: 'feat: x (#4)' });
    expect(run.status).toBe(BUILD);
    expect(run.stdout).toMatch(/fallback/);
  });
});

describe('on any other branch', () => {
  it.each([
    'feat/topic', 'feat/topic--s2', 'feat/topic-1of2-expand', 'fix/topic', 'docs/phase-0-topic',
    'docs/retro-topic', 'docs/knowledge-topic', 'claude/xyz', 'dependabot/npm_and_yarn/next-16.4.0',
  ])('skips %s without its preview status', async (branch) => {
    const { root, commit } = repo();
    const sha = commit('feat: x', { 'apps/galaxy/a.ts': 'x' });
    const run = await ignore(root, 'galaxy', { VERCEL_GIT_COMMIT_REF: branch, VERCEL_GIT_COMMIT_SHA: sha });
    expect(run.status).toBe(SKIP);
  });

  it('builds a commit carrying its own project\'s preview status, and only that project', async () => {
    const { root, commit } = repo();
    const sha = commit('chore(delivery): ship PRD 1', { 'apps/galaxy/a.ts': 'x' });
    statuses.set(sha, ['vercel/preview/galaxy']);
    const env = { VERCEL_GIT_COMMIT_REF: 'feat/topic', VERCEL_GIT_COMMIT_SHA: sha };
    expect((await ignore(root, 'galaxy', env)).status).toBe(BUILD);
    expect((await ignore(root, 'omni-app', env)).status).toBe(SKIP);
  });

  it('skips when GitHub cannot be asked: no token, or no answer', async () => {
    const { root, commit } = repo();
    const sha = commit('feat: x', { 'apps/galaxy/a.ts': 'x' });
    statuses.set(sha, ['vercel/preview/galaxy']);
    const env = { VERCEL_GIT_COMMIT_REF: 'feat/topic', VERCEL_GIT_COMMIT_SHA: sha };
    expect((await ignore(root, 'galaxy', { ...env, GITHUB_STATUS_TOKEN: '' })).status).toBe(SKIP);
    unreachable = true;
    const run = await ignore(root, 'galaxy', env);
    expect(run.status).toBe(SKIP);
    expect(run.stdout).toMatch(/could not read/);
  });
});

describe('always', () => {
  it('VERCEL_FORCE_BUILD=1 builds every deployment', async () => {
    const { root, commit } = repo();
    const sha = commit('feat: x', { 'README.md': 'x' });
    for (const branch of ['main', 'claude/xyz']) {
      expect((await ignore(root, 'omni-app', { VERCEL_FORCE_BUILD: '1', VERCEL_GIT_COMMIT_REF: branch, VERCEL_GIT_COMMIT_SHA: sha })).status).toBe(BUILD);
    }
  });

  it('builds without a project or a branch name', async () => {
    const { root } = repo();
    expect((await ignore(root, '', { VERCEL_GIT_COMMIT_REF: 'main' })).status).toBe(BUILD);
    expect((await ignore(root, 'galaxy', {})).status).toBe(BUILD);
  });

  it.each([['apps/galaxy', 'galaxy'], ['apps/omni-app', 'omni-app']])('%s/vercel.json runs it from the repository root, for its project', (app, project) => {
    const config: unknown = JSON.parse(readFileSync(join(here, '..', app, 'vercel.json'), 'utf8'));
    expect(digText(config, 'ignoreCommand')).toBe(`cd ../.. && bash scripts/vercel-ignore.sh ${project}`);
  });

  it('omni-app installs its runtime dependencies only', () => {
    const config: unknown = JSON.parse(readFileSync(join(here, '..', 'apps/omni-app/vercel.json'), 'utf8'));
    expect(digText(config, 'installCommand')).toBe('pnpm install --frozen-lockfile --prod --filter @omni/omni-app...');
  });

  it('omni-app declares every npm package its committed bundles import, so that install finds them', () => {
    const imported = bundleImports(join(here, '..', 'apps/omni-app/api'));
    expect(imported.size).toBeGreaterThan(0);
    const declared = dependenciesOf(join(here, '..', 'apps/omni-app/package.json'));
    expect([...imported].filter((pkg) => !declared.includes(pkg))).toEqual([]);
  });
});

function dependenciesOf(manifestPath: string): string[] {
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || !('dependencies' in manifest)) return [];
  const deps = manifest.dependencies;
  return deps && typeof deps === 'object' ? Object.keys(deps) : [];
}

/** `@scope/name/sub` → `@scope/name`, `name/sub` → `name`. */
const packageName = (spec: string): string => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');

/** The npm packages the bundles in `dir` import, Node built-ins aside. */
function bundleImports(dir: string): Set<string> {
  const specs = readdirSync(dir)
    .filter((f) => f.endsWith('.mjs'))
    .flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/^import [^;]* from "([^".][^"]*)"|import\("([^".][^"]*)"\)/gm)])
    .map((m) => m[1] ?? m[2] ?? '');
  return new Set(specs.filter((spec) => spec !== '' && !spec.startsWith('node:')).map(packageName));
}
