// The hook installer of PRD 1814 (`pnpm install` runs it as `prepare`), and the Claude-only gate it
// replaces, gone.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../kit/test/fixture.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INSTALLER = join(ROOT, 'scripts/install-hooks.ts');

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Runs the installer from `cwd`, git never looking above `cwd`'s parent for a repository. */
function install(cwd: string) {
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(cwd) };
  const result = spawnSync(process.execPath, [INSTALLER], { cwd, env, encoding: 'utf8' });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const hooksPath = (cwd: string) =>
  spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd, encoding: 'utf8' }).stdout.trim();

describe('the installer', () => {
  it('sets core.hooksPath to .githooks in a git work tree, and says so in one line', () => {
    const { root } = makeRepo({ git: true });
    scratch.push(root);
    const { code, stdout } = install(root);
    expect(code).toBe(0);
    expect(hooksPath(root)).toBe('.githooks');
    expect(stdout).toBe('install-hooks: git hooks on (core.hooksPath .githooks)\n');
  });

  it('one install serves every worktree of the checkout, each running its own .githooks', () => {
    const { root } = makeRepo({ git: true });
    scratch.push(root);
    const tree = join(realpathSync(mkdtempSync(join(tmpdir(), 'omni-wt-'))), 'wt');
    scratch.push(dirname(tree));
    execFileSync('git', ['worktree', 'add', '-q', '-b', 'slice', tree], { cwd: root, stdio: 'ignore' });
    install(root);
    expect(hooksPath(tree)).toBe('.githooks');
  });

  it('outside a git work tree, exits 0 with one skip line and writes nothing', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'omni-nogit-')));
    scratch.push(dir);
    const { code, stdout } = install(dir);
    expect(code).toBe(0);
    expect(stdout).toBe('install-hooks: not a git work tree, git hooks skipped\n');
    expect(existsSync(join(dir, '.git'))).toBe(false);
  });

  it('is what `pnpm install` runs, as the root package’s prepare script', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.prepare).toBe('node scripts/install-hooks.ts');
  });
});

describe('the Claude-only fallow gate is gone (the git hook audits every commit)', () => {
  type Settings = { hooks: Record<string, { hooks: { command: string }[] }[] | undefined> };
  const settings = JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8')) as Settings;

  it('its script and its test are deleted', () => {
    expect(existsSync(join(ROOT, '.claude/hooks/fallow-gate.sh'))).toBe(false);
    expect(existsSync(join(ROOT, '.claude/hooks/fallow-gate.test.ts'))).toBe(false);
  });

  it('no PreToolUse entry runs it, and the SessionStart briefing stays', () => {
    expect(JSON.stringify(settings.hooks.PreToolUse ?? [])).not.toContain('fallow-gate');
    expect(settings.hooks.SessionStart?.flatMap((entry) => entry.hooks.map((hook) => hook.command))).toContain(
      'node .omni-loop/bin/omni.mjs kb show briefing',
    );
  });
});
