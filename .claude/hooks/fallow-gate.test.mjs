import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'fallow-gate.sh');

const scratch = [];
afterEach(() => {
  while (scratch.length) rmSync(scratch.pop(), { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'fallow-gate-'));
  scratch.push(dir);
  return dir;
}

// Runs the hook as Claude Code does: the Bash tool input as JSON on stdin, with the directory the
// command runs in as `cwd`. The hook's own working directory is an empty folder, so no
// node_modules/.bin/fallow is found there; PATH decides what is reachable.
function runHook(command, { env = {}, path = process.env.PATH, cwd } = {}) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, ...(cwd ? { cwd } : {}) });
  const { CLAUDE_PROJECT_DIR, FALLOW_GATE_DEBUG, ...base } = process.env;
  return spawnSync('bash', [HOOK], {
    input,
    cwd: tempDir(),
    encoding: 'utf8',
    env: { ...base, PATH: path, ...env },
  });
}

// A folder holding only a `fallow` that answers --version and prints the given audit JSON.
function stubFallow(auditJson, auditExit = 0) {
  const bin = join(tempDir(), 'bin');
  mkdirSync(bin);
  const file = join(bin, 'fallow');
  writeFileSync(
    file,
    `#!/usr/bin/env bash
if [ "$1" = "--version" ]; then echo "fallow 3.30.0"; exit 0; fi
printf '%s\\n' '${auditJson}'
exit ${auditExit}
`,
  );
  chmodSync(file, 0o755);
  return bin;
}

describe('fallow-gate: which commands are audited', () => {
  const dryRun = (command) => runHook(command, { env: { FALLOW_GATE_DRY_RUN: '1' } });

  it.each([
    'git commit -m x',
    'git push',
    'git -C dir push',
    'git -c a=b commit',
    'git --no-pager commit',
    'pnpm test && git commit -m x',
    '(cd x; git push)',
    'echo git push',
  ])('audits %j', (command) => {
    const run = dryRun(command);
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe('audit');
  });

  it.each(['git log commit.txt', 'git status', 'ls', ''])('skips %j', (command) => {
    const run = dryRun(command);
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe('skip');
  });
});

describe('fallow-gate: what the audit decides', () => {
  const systemPath = '/usr/bin:/bin';

  it('blocks with exit 2 and the findings on stderr when the verdict is fail', () => {
    const bin = stubFallow('{"verdict":"fail"}', 1);
    const run = runHook('git commit -m x', { path: `${bin}:${systemPath}` });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('{"verdict":"fail"}');
  });

  it('lets the command through when the verdict is pass', () => {
    const bin = stubFallow('{"verdict":"pass"}');
    const run = runHook('git push', { path: `${bin}:${systemPath}` });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
  });

  it('lets the command through with one stderr line when no fallow is reachable', () => {
    const run = runHook('git push', { path: systemPath });
    expect(run.status).toBe(0);
    const lines = run.stderr.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/fallow-gate: .*fallow.*not found/);
  });

  it('lets the command through with one stderr line when the audit crashes', () => {
    const bin = stubFallow('not json', 101);
    const run = runHook('git push', { path: `${bin}:${systemPath}` });
    expect(run.status).toBe(0);
    expect(run.stderr.trim().split('\n')).toHaveLength(1);
    expect(run.stderr).toMatch(/fallow-gate: fallow audit exited 101/);
  });

  it('never runs the audit for a command that is not a commit or a push', () => {
    const bin = stubFallow('{"verdict":"fail"}', 1);
    const run = runHook('git status', { path: `${bin}:${systemPath}` });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
  });
});

// A git checkout holding a .fallowrc.jsonc, and a `fallow` that writes the folder it audits from.
function checkout() {
  const root = tempDir();
  spawnSync('git', ['init', '-q', root]);
  writeFileSync(join(root, '.fallowrc.jsonc'), '{}\n');
  mkdirSync(join(root, 'apps'));
  return root;
}

function stubFallowRecordingCwd(record) {
  const bin = join(tempDir(), 'bin');
  mkdirSync(bin);
  const file = join(bin, 'fallow');
  writeFileSync(
    file,
    `#!/usr/bin/env bash
if [ "$1" = "--version" ]; then echo "fallow 3.30.0"; exit 0; fi
pwd -P > '${record}'
printf '%s\\n' '{"verdict":"pass"}'
`,
  );
  chmodSync(file, 0o755);
  return bin;
}

describe('fallow-gate: which checkout is audited', () => {
  const systemPath = '/usr/bin:/bin';
  const audited = (record) => readFileSync(record, 'utf8').trim();

  it('audits the checkout the command runs in, a worktree, not the project folder', () => {
    const project = checkout();
    const worktree = checkout();
    const record = join(tempDir(), 'cwd');
    const bin = stubFallowRecordingCwd(record);
    const run = runHook('git commit -m x', {
      path: `${bin}:${systemPath}`,
      env: { CLAUDE_PROJECT_DIR: project },
      cwd: join(worktree, 'apps'),
    });
    expect(run.status).toBe(0);
    expect(audited(record)).toBe(realpathSync(worktree));
  });

  it('audits the project folder when the command runs outside a checkout with a fallow config', () => {
    const project = checkout();
    const record = join(tempDir(), 'cwd');
    const bin = stubFallowRecordingCwd(record);
    const run = runHook('git push', {
      path: `${bin}:${systemPath}`,
      env: { CLAUDE_PROJECT_DIR: project },
      cwd: tempDir(),
    });
    expect(run.status).toBe(0);
    expect(audited(record)).toBe(realpathSync(project));
  });
});
