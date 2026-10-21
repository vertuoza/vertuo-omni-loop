// The git hooks of PRD 1814, run as git runs them: each `.githooks/` script in a fixture repository,
// with stub `fallow` and `pnpm` that record what they were asked and answer as told. PATH holds only
// the system folders and a folder with `node` and `git`, so a tool is found only where a test puts it.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../kit/test/fixture.ts';
import { type HookIO, preCommit, prePush, runHook, searchPath, touchesDatabase } from './check-changed-hooks.ts';

const HOOKS = fileURLToPath(new URL('../.githooks/', import.meta.url));

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'omni-hooks-')));
  scratch.push(dir);
  return dir;
}

const which = (name: string) => execFileSync('/bin/sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).trim();

/** A folder holding only `node` and `git`, so neither `pnpm` nor `fallow` is reachable through it. */
function toolsOnly(): string {
  const bin = join(tempDir(), 'bin');
  mkdirSync(bin);
  symlinkSync(process.execPath, join(bin, 'node'));
  symlinkSync(which('git'), join(bin, 'git'));
  return bin;
}

/** A stub `name` in `dir`: it appends `pwd` and its arguments to `<dir>/<name>.log`, prints `say`, exits `code`. */
function stub(dir: string, name: string, { code = 0, say = '', failOn = '' }: { code?: number; say?: string; failOn?: string } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  const fail = failOn ? `case "$*" in *${failOn}*) echo "${name}: ${failOn} failed"; exit 1;; esac\n` : '';
  writeFileSync(file, `#!/bin/sh\necho "$(pwd) $*" >> "${file}.log"\n${fail}${say ? `echo "${say}"\n` : ''}exit ${String(code)}\n`);
  chmodSync(file, 0o755);
  return { log: () => (existsSync(`${file}.log`) ? readFileSync(`${file}.log`, 'utf8') : '') };
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** A fixture repository, its root resolved (macOS's temp folder is a symlink). */
function repo(files: Record<string, string> = { 'kit/lib/a.ts': 'export const a = 1;\n' }): string {
  const { root } = makeRepo({ files, git: true });
  scratch.push(root);
  return realpathSync(root);
}

/** Runs `.githooks/<hook>` from `cwd` as git does, with `extraPath` before the tools-only PATH. */
function runGitHook(hook: 'pre-commit' | 'pre-push', cwd: string, extraPath: string[] = []) {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: [...extraPath, toolsOnly(), '/usr/bin', '/bin'].join(':') };
  delete env.npm_execpath;
  const result = spawnSync('/bin/sh', [join(HOOKS, hook)], { cwd, env, encoding: 'utf8' });
  return { code: result.status, out: `${result.stdout}${result.stderr}`, stderr: result.stderr };
}

describe('pre-commit: the fallow audit of the work tree being committed', () => {
  it('passes when the audit passes, run from the work tree root', () => {
    const root = repo();
    const fallow = stub(join(root, 'node_modules/.bin'), 'fallow');
    const { code } = runGitHook('pre-commit', root);
    expect(code).toBe(0);
    expect(fallow.log()).toBe(`${root} audit\n`);
  });

  it('refuses when the audit fails, with its findings', () => {
    const root = repo();
    stub(join(root, 'node_modules/.bin'), 'fallow', { code: 1, say: 'unused export: kit/lib/a.ts a' });
    const { code, out } = runGitHook('pre-commit', root);
    expect(code).not.toBe(0);
    expect(out).toContain('unused export: kit/lib/a.ts a');
    expect(out).toContain('pre-commit: refused');
  });

  it('refuses when the audit cannot run: a runtime error fails closed', () => {
    const root = repo();
    stub(join(root, 'node_modules/.bin'), 'fallow', { code: 2, say: 'error: baseline unreadable' });
    const { code, out } = runGitHook('pre-commit', root);
    expect(code).not.toBe(0);
    expect(out).toContain('pre-commit: fallow audit could not run (exit 2)');
  });

  it('refuses in one line naming fallow and `run pnpm install` when fallow is nowhere', () => {
    const root = repo();
    const { code, stderr } = runGitHook('pre-commit', root);
    expect(code).not.toBe(0);
    expect(stderr.trim().split('\n')).toHaveLength(1);
    expect(stderr).toMatch(/^pre-commit: fallow not found .*: run pnpm install\n$/);
  });

  it('finds fallow on PATH when no node_modules holds it', () => {
    const root = repo();
    const bin = tempDir();
    const fallow = stub(bin, 'fallow');
    expect(runGitHook('pre-commit', root, [bin]).code).toBe(0);
    expect(fallow.log()).toBe(`${root} audit\n`);
  });

  it('in a git worktree with no install, uses the main checkout’s fallow and audits the worktree', () => {
    const main = repo();
    const fallow = stub(join(main, 'node_modules/.bin'), 'fallow');
    const tree = join(tempDir(), 'wt');
    git(main, 'worktree', 'add', '-q', '-b', 'slice', tree);
    const { code } = runGitHook('pre-commit', tree);
    expect(code).toBe(0);
    expect(fallow.log()).toBe(`${tree} audit\n`);
  });

  it('prefers the work tree’s own fallow over the main checkout’s and PATH’s', () => {
    const main = repo();
    const mainFallow = stub(join(main, 'node_modules/.bin'), 'fallow');
    const tree = join(tempDir(), 'wt');
    git(main, 'worktree', 'add', '-q', '-b', 'slice', tree);
    const own = stub(join(tree, 'node_modules/.bin'), 'fallow');
    const bin = tempDir();
    const onPath = stub(bin, 'fallow');
    expect(runGitHook('pre-commit', tree, [bin]).code).toBe(0);
    expect(own.log()).toBe(`${tree} audit\n`);
    expect(mainFallow.log() + onPath.log()).toBe('');
  });

  it('git itself refuses the commit once core.hooksPath points at the hooks', () => {
    const root = repo();
    stub(join(root, 'node_modules/.bin'), 'fallow', { code: 1, say: 'unused export: kit/lib/b.ts b' });
    git(root, 'config', 'core.hooksPath', HOOKS);
    writeFileSync(join(root, 'kit/lib/b.ts'), 'export const b = 2;\n');
    git(root, 'add', '-A');
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: [toolsOnly(), '/usr/bin', '/bin'].join(':') };
    const commit = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-m', 'b'], { cwd: root, env, encoding: 'utf8' });
    expect(commit.status).not.toBe(0);
    expect(`${commit.stdout}${commit.stderr}`).toContain('unused export: kit/lib/b.ts b');
    expect(git(root, 'log', '--format=%s', '-1').trim()).toBe('fixture');
  });
});

/** A fixture repository on `work`, cut from `main`, with `origin/main` at `main` and one TS change committed. */
function pushRepo(): string {
  const root = repo({ 'kit/lib/a.ts': 'export const a = 1;\n', 'README.md': '# r\n' });
  git(root, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(root, 'checkout', '-q', '-b', 'work');
  writeFileSync(join(root, 'kit/lib/a.ts'), 'export const a = 2;\n');
  git(root, 'commit', '-qam', 'a');
  return root;
}

describe('pre-push: check:changed’s typecheck and lint, nothing else', () => {
  it('runs the typecheck, then lint of the changed TypeScript, against origin/main when there is no upstream', () => {
    const root = pushRepo();
    const pnpm = stub(join(root, 'node_modules/.bin'), 'pnpm');
    const { code, out } = runGitHook('pre-push', root);
    expect(code).toBe(0);
    expect(pnpm.log()).toBe(`${root} typecheck\n${root} lint kit/lib/a.ts\n`);
    expect(out).toContain('2 steps passed');
  });

  it('never runs the tests or the audit, even when a shared file changed', () => {
    const root = pushRepo();
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'lock');
    const pnpm = stub(join(root, 'node_modules/.bin'), 'pnpm');
    expect(runGitHook('pre-push', root).code).toBe(0);
    expect(pnpm.log()).not.toMatch(/ test|fallow|vitest/);
  });

  it('measures from the merge-base with the branch’s upstream when it has one', () => {
    const root = pushRepo();
    git(root, 'branch', 'base');
    writeFileSync(join(root, 'kit/lib/c.ts'), 'export const c = 1;\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'c');
    git(root, 'branch', '--set-upstream-to=base');
    const pnpm = stub(join(root, 'node_modules/.bin'), 'pnpm');
    expect(runGitHook('pre-push', root).code).toBe(0);
    expect(pnpm.log()).toContain(`${root} lint kit/lib/c.ts\n`);
    expect(pnpm.log()).not.toContain('kit/lib/a.ts');
  });

  it('refuses when lint fails', () => {
    const root = pushRepo();
    stub(join(root, 'node_modules/.bin'), 'pnpm', { failOn: 'lint' });
    const { code, out } = runGitHook('pre-push', root);
    expect(code).not.toBe(0);
    expect(out).toContain('pnpm: lint failed');
    expect(out).toContain('pre-push: refused');
  });

  it('refuses when the typecheck fails, before lint runs', () => {
    const root = pushRepo();
    const pnpm = stub(join(root, 'node_modules/.bin'), 'pnpm', { failOn: 'typecheck' });
    expect(runGitHook('pre-push', root).code).not.toBe(0);
    expect(pnpm.log()).not.toContain('lint');
  });

  it('refuses in one line naming pnpm and `run pnpm install` when pnpm is nowhere', () => {
    const root = pushRepo();
    const { code, stderr } = runGitHook('pre-push', root);
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/^pre-push: pnpm not found .*run pnpm install\n$/);
  });

  it('refuses in one line when there is no base to measure from', () => {
    const root = repo();
    stub(join(root, 'node_modules/.bin'), 'pnpm');
    const { code, stderr } = runGitHook('pre-push', root);
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/^pre-push: no merge-base with origin\/main: run git fetch origin\n$/);
  });
});

describe('the hooks themselves', () => {
  it.each(['pre-commit', 'pre-push'])('%s is executable POSIX shell that reads no JSON', (hook) => {
    const text = readFileSync(join(HOOKS, hook), 'utf8');
    expect(text.startsWith('#!/bin/sh\n')).toBe(true);
    expect(text).not.toMatch(/\bjq\b|bash/);
    expect(execFileSync('/bin/sh', ['-c', `test -x "${join(HOOKS, hook)}" && echo yes`], { encoding: 'utf8' }).trim()).toBe('yes');
  });

  it.each(['pre-commit', 'pre-push'])('%s refuses in one line when node is not on PATH', (hook) => {
    const root = repo();
    const result = spawnSync('/bin/sh', [join(HOOKS, hook)], { cwd: root, env: { ...process.env, PATH: '/nonexistent' }, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toBe(`${hook}: node not found on PATH: install Node >= 22.18, then run pnpm install\n`);
  });
});

/** An IO that records every command run and answers each from `codes` (by tool and first argument), git from `refs`. */
function fakeIO({ codes = {}, refs = {} }: { codes?: Record<string, number>; refs?: Record<string, string> } = {}) {
  const ran: string[] = [];
  const warned: string[] = [];
  const io: HookIO = {
    run: (file, args) => {
      const name = file.split('/').pop() ?? file;
      ran.push([name, ...args].join(' '));
      return codes[`${name} ${args[0] ?? ''}`] ?? 0;
    },
    git: (_cwd, args) => refs[args.join(' ')] ?? null,
    write: () => undefined,
    warn: (text) => warned.push(text),
    path: '',
  };
  return { io, ran, warned };
}

describe('runHook, with git and the tools faked', () => {
  it('an unknown hook refuses, naming the two it knows', () => {
    const { io, warned } = fakeIO();
    expect(runHook('post-merge', '/x', io)).toBe(1);
    expect(warned).toEqual(['check:changed: unknown hook "post-merge": pre-commit or pre-push\n']);
  });

  it('outside a git work tree it refuses', () => {
    const { io, warned } = fakeIO();
    expect(runHook('pre-commit', '/x', io)).toBe(1);
    expect(warned).toEqual(['pre-commit: not inside a git work tree\n']);
  });

  it('looks in the work tree’s install, the main checkout’s, then PATH, each once', () => {
    const { io } = fakeIO({ refs: { 'rev-parse --path-format=absolute --git-common-dir': '/main/.git' } });
    expect(searchPath('/main/.claude/worktrees/a', { ...io, path: '/usr/bin:/bin' })).toEqual([
      '/main/.claude/worktrees/a/node_modules/.bin',
      '/main/node_modules/.bin',
      '/usr/bin',
      '/bin',
    ]);
    expect(searchPath('/main', io)).toEqual(['/main/node_modules/.bin']);
  });

  it('pre-commit maps the audit’s exit code: 0 passes, 1 is a finding, anything else could not run', () => {
    const root = repo();
    const bin = join(root, 'node_modules/.bin');
    stub(bin, 'fallow');
    for (const [code, said] of [[1, 'refused'], [2, 'could not run (exit 2)'], [134, 'could not run (exit 134)']] as const) {
      const { io, warned } = fakeIO({ codes: { 'fallow audit': code } });
      expect(preCommit(root, [bin], io)).toBe(1);
      expect(warned.join('')).toContain(said);
    }
    expect(preCommit(root, [bin], fakeIO().io)).toBe(0);
  });

  it('pre-push asks for typecheck and lint alone, against the upstream when there is one', () => {
    const root = pushRepo();
    const bin = join(root, 'node_modules/.bin');
    stub(bin, 'pnpm');
    const base = git(root, 'merge-base', 'HEAD', 'main').trim();
    const upstream = { 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/feat/x', 'merge-base HEAD origin/feat/x': base };
    const { io, ran } = fakeIO({ refs: upstream });
    expect(prePush(root, [bin], io)).toBe(0);
    expect(ran).toEqual(['pnpm typecheck', 'pnpm lint kit/lib/a.ts']);
  });
});

describe('pre-push: the committed database types against the local database', () => {
  const CHECK = 'node scripts/supabase-types.ts';

  /** pushRepo, plus a new migration committed on `work`. */
  function migrationRepo(): string {
    const root = pushRepo();
    mkdirSync(join(root, 'supabase/migrations'), { recursive: true });
    writeFileSync(join(root, 'supabase/migrations/20990101000000_x.sql'), 'select 1;\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'migration');
    return root;
  }

  function push(root: string, codes: Record<string, number> = {}) {
    const bin = join(root, 'node_modules/.bin');
    stub(bin, 'pnpm');
    const base = git(root, 'merge-base', 'HEAD', 'main').trim();
    const fake = fakeIO({ codes, refs: { 'merge-base HEAD origin/main': base } });
    return { code: prePush(root, [bin], fake.io), ...fake };
  }

  it('touchesDatabase: a migration or the types file, tracked or new, and nothing else under supabase/', () => {
    expect(touchesDatabase({ tracked: ['supabase/migrations/1_a.sql'], untracked: [] })).toBe(true);
    expect(touchesDatabase({ tracked: [], untracked: ['supabase/database.types.ts'] })).toBe(true);
    expect(touchesDatabase({ tracked: ['supabase/seed.sql', 'supabase/checks/a.sql', 'kit/lib/a.ts'], untracked: [] })).toBe(false);
  });

  it('never checks the types when the push touches no migration', () => {
    const { code, ran } = push(pushRepo());
    expect(code).toBe(0);
    expect(ran.some((line) => line.startsWith(CHECK))).toBe(false);
  });

  it('checks them after typecheck and lint when a migration changed, and passes when they match', () => {
    const { code, ran } = push(migrationRepo());
    expect(code).toBe(0);
    expect(ran.at(-1)).toBe(`${CHECK} --check`);
  });

  it('refuses on drift, saying never to hand-edit the file and how to regenerate it', () => {
    const { code, warned } = push(migrationRepo(), { [CHECK]: 1 });
    expect(code).toBe(1);
    expect(warned.join('')).toMatch(/Never hand-edit it: supabase stop --no-backup && supabase db start, then node scripts\/supabase-types.ts/);
  });

  it('only warns when no local database answers: CI runs the same check', () => {
    const { code, warned } = push(migrationRepo(), { [CHECK]: 2 });
    expect(code).toBe(0);
    expect(warned.join('')).toMatch(/not checked, no local database answered; CI will check them/);
  });

  it('never checks the types when lint already refused', () => {
    const { code, ran } = push(migrationRepo(), { 'pnpm lint': 1 });
    expect(code).toBe(1);
    expect(ran.some((line) => line.startsWith(CHECK))).toBe(false);
  });
});
