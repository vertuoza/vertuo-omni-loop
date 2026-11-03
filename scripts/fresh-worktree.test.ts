// A fresh worktree of this repository is ready to work in (#2613): `git worktree add` installs its
// dependencies through `.githooks/post-checkout`, and the Supabase CLI the repository relies on is
// declared at the version its workflows pin. A worktree Claude Code makes for a subagent runs no git
// hook, so `omni`, the first thing every skill runs, installs what is missing too. Hook and bin run for
// real, in a scratch folder, with a `pnpm` of the test's own on the PATH: nothing is installed.
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A scratch repository running this repository's hooks, and a `pnpm` that notes where it ran and exits `pnpmExit`. */
function scratchRepo({ lockfile = true, pnpmExit = 0 } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'fresh-worktree-'));
  scratch.push(home);
  const repo = join(home, 'repo');
  const calls = join(home, 'calls');
  const env = { ...process.env, PATH: `${home}${delimiter}${process.env.PATH ?? ''}`, GIT_CEILING_DIRECTORIES: home };
  const git = (...args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: repo, env, encoding: 'utf8' });
  writeFileSync(join(home, 'pnpm'), `#!/bin/sh\necho "$PWD $*" >> "${calls}"\nexit ${String(pnpmExit)}\n`);
  chmodSync(join(home, 'pnpm'), 0o755);
  spawnSync('git', ['init', '-q', '-b', 'main', repo], { env });
  cpSync(join(ROOT, '.githooks'), join(repo, '.githooks'), { recursive: true });
  if (lockfile) writeFileSync(join(repo, 'pnpm-lock.yaml'), '');
  git('add', '.');
  git('commit', '-q', '--no-verify', '-m', 'init');
  git('config', 'core.hooksPath', '.githooks');
  return { home, git, calls: () => (existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n') : []) };
}

describe('.githooks/post-checkout', () => {
  it('installs the dependencies of a worktree just made, in that worktree', () => {
    const { home, git, calls } = scratchRepo();
    const made = git('worktree', 'add', '-q', '--detach', join(home, 'fresh'), 'HEAD');
    expect(made.status).toBe(0);
    expect(calls().map((call) => call.replace(/^.*\/fresh /, 'fresh '))).toEqual(['fresh install --frozen-lockfile --silent']);
  });

  it('installs nothing on a switch between branches', () => {
    const { git, calls } = scratchRepo();
    expect(git('switch', '-q', '-c', 'other').status).toBe(0);
    expect(calls()).toEqual([]);
  });

  it('installs nothing in a worktree with no lockfile', () => {
    const { home, git, calls } = scratchRepo({ lockfile: false });
    expect(git('worktree', 'add', '-q', '--detach', join(home, 'fresh'), 'HEAD').status).toBe(0);
    expect(calls()).toEqual([]);
  });

  it('never fails the worktree when the install fails, and says what to run', () => {
    const { home, git } = scratchRepo({ pnpmExit: 1 });
    const made = git('worktree', 'add', '-q', '--detach', join(home, 'fresh'), 'HEAD');
    expect(made.status).toBe(0);
    expect(existsSync(join(home, 'fresh', 'pnpm-lock.yaml'))).toBe(true);
    expect(made.stderr).toContain('post-checkout: pnpm install failed here: run pnpm install --frozen-lockfile');
  });
});

/** A worktree holding this repository's `omni` bin, a kit that prints `ran`, and a `pnpm` that runs `pnpmBody`. */
function scratchBin({ installed = false, pnpmBody = 'mkdir -p node_modules/yaml' } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'fresh-omni-'));
  scratch.push(home);
  const tree = join(home, 'tree');
  const calls = join(home, 'calls');
  mkdirSync(join(tree, '.omni-loop/bin'), { recursive: true });
  mkdirSync(join(tree, 'kit/bin'), { recursive: true });
  if (installed) mkdirSync(join(tree, 'node_modules/yaml'), { recursive: true });
  cpSync(join(ROOT, '.omni-loop/bin/omni.mjs'), join(tree, '.omni-loop/bin/omni.mjs'));
  writeFileSync(join(tree, 'kit/bin/omni.ts'), "export const main = async (args) => { console.log('ran', args.join(' ')); return 3; };\n");
  writeFileSync(join(home, 'pnpm'), `#!/bin/sh\necho "$*" >> "${calls}"\necho noise\n${pnpmBody}\n`);
  chmodSync(join(home, 'pnpm'), 0o755);
  const env = { ...process.env, PATH: `${home}${delimiter}${process.env.PATH ?? ''}` };
  const omni = spawnSync(process.execPath, [join(tree, '.omni-loop/bin/omni.mjs'), 'config'], { cwd: home, env, encoding: 'utf8' });
  return { omni, calls: () => (existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n') : []) };
}

describe('.omni-loop/bin/omni.mjs', () => {
  it('installs what a worktree lacks before it starts, and keeps its stdout the command\'s own', () => {
    const { omni, calls } = scratchBin();
    expect(calls()).toEqual(['install --frozen-lockfile --silent']);
    expect(omni.stdout).toBe('ran config\n');
    expect(omni.status).toBe(3);
  });

  it('installs nothing when the dependencies are there', () => {
    const { omni, calls } = scratchBin({ installed: true });
    expect(calls()).toEqual([]);
    expect(omni.stdout).toBe('ran config\n');
  });

  it('says what to run when the install fails, and still tries the command', () => {
    const { omni } = scratchBin({ pnpmBody: 'exit 1' });
    expect(omni.stderr).toContain('omni: pnpm install failed here: run pnpm install --frozen-lockfile');
    expect(omni.stdout).toBe('ran config\n');
  });
});

describe('the Supabase CLI', () => {
  it('is declared at the version every workflow pins', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { devDependencies: Record<string, string> };
    const workflow = readFileSync(join(ROOT, '.github/workflows/supabase.yml'), 'utf8');
    const pins = [...workflow.matchAll(/supabase\/setup-cli@\S+\n\s+with: \{ version: ([\d.]+) \}/g)].map((pin) => pin[1]);
    expect(pins.length).toBeGreaterThan(0);
    expect(new Set(pins)).toEqual(new Set([pkg.devDependencies.supabase]));
  });
});
