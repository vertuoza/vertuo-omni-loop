// What runs inside a job's session (PRD 1904, "One readable line per step"): claude runs with
// stream-json, its readable lines reach the job's log and the pane, its raw stream the `.jsonl` beside
// the log, and the install's output and claude's stderr are written as they are. A fake `claude`
// (and a fake `pnpm`) on the PATH stand in for the real ones.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lastPullRequest } from './log.ts';
import { rawLogPath, runJobProcess } from './job.ts';

const STREAM = join(import.meta.dirname, 'fixtures', 'stream.jsonl');

/** A job's folder, its files, and a `bin` holding the fake `claude` and `pnpm`. */
function fixture({ lockfile = false, exit = 0, line = '/omni:yolo 1717', mcp = false }: { lockfile?: boolean; exit?: number; line?: string; mcp?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-job-'));
  const bin = join(root, 'bin');
  const cwd = join(root, 'wt');
  mkdirSync(bin);
  mkdirSync(cwd);
  if (lockfile) writeFileSync(join(cwd, 'pnpm-lock.yaml'), '');
  if (mcp) writeFileSync(join(cwd, '.mcp.json'), '{"mcpServers":{}}\n');
  // The fake claude: records its arguments and its standard input, prints the recorded stream with
  // a partial last line, and one line on its standard error.
  writeFileSync(
    join(bin, 'claude'),
    [
      '#!/bin/sh',
      `printf '%s\\n' "$@" > "${join(root, 'args')}"`,
      `cat > "${join(root, 'stdin')}"`,
      `cat "${STREAM}"`,
      'echo "a plain line"',
      'echo "claude: warning" >&2',
      'printf "tail without newline"',
      `exit ${String(exit)}`,
      '',
    ].join('\n'),
  );
  writeFileSync(join(bin, 'pnpm'), ['#!/bin/sh', 'echo "Lockfile is up to date"', 'echo "{\\"type\\":\\"result\\"}"', ''].join('\n'));
  chmodSync(join(bin, 'claude'), 0o755);
  chmodSync(join(bin, 'pnpm'), 0o755);
  const files = { line: join(root, 'job-7.line'), log: join(root, 'job-7.log'), exit: join(root, 'job-7.exit') };
  writeFileSync(files.line, `${line}\n`);
  writeFileSync(files.log, '');
  let pane = '';
  const out = { write: (chunk: string) => (pane += chunk) };
  const env = { PATH: `${bin}:${String(process.env.PATH)}` };
  return { root, cwd, files, out, env, pane: () => pane };
}

describe('runJobProcess', () => {
  it('runs claude with stream-json, the line on its standard input', async () => {
    const f = fixture();
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env })).toBe(0);
    expect(readFileSync(join(f.root, 'args'), 'utf8').trim().split('\n')).toEqual(['--dangerously-skip-permissions', '-p', '--output-format', 'stream-json', '--verbose']);
    expect(readFileSync(join(f.root, 'stdin'), 'utf8')).toBe('/omni:yolo 1717\n');
    expect(readFileSync(f.files.exit, 'utf8')).toBe('0\n');
  });

  it('writes the readable lines to the log and the pane, and the raw stream to the .jsonl', async () => {
    const f = fixture();
    await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env });
    const log = readFileSync(f.files.log, 'utf8');
    expect(log).toMatch(/^\d\d:\d\d:\d\d › I will start with the plan\.$/m);
    expect(log).toMatch(/^\d\d:\d\d:\d\d Bash: pnpm test$/m);
    expect(log).toMatch(/^\d\d:\d\d:\d\d ✗ Error: 3 tests failed$/m);
    expect(log).toMatch(/^\d\d:\d\d:\d\d Done: ok · 12 turns · \$1\.23 · 12m 34s$/m);
    expect(log).not.toContain('"type"');
    // A line that is not JSON, claude's standard error and a last line with no newline, as they are.
    expect(log).toMatch(/^a plain line$/m);
    expect(log).toMatch(/^claude: warning$/m);
    expect(log.endsWith('tail without newline\n')).toBe(true);
    expect(f.pane()).toContain('Bash: pnpm test');
    expect(f.pane()).toContain('claude: warning');
    expect(f.pane()).not.toContain('"type"');

    const raw = readFileSync(rawLogPath(f.files.log), 'utf8');
    expect(rawLogPath(f.files.log)).toBe(join(f.root, 'job-7.jsonl'));
    expect(raw.startsWith(readFileSync(STREAM, 'utf8'))).toBe(true);
    expect(raw).not.toContain('claude: warning');
  });

  it('keeps the pull request in the readable log for lastPullRequest', async () => {
    const f = fixture();
    await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env });
    expect(lastPullRequest(readFileSync(f.files.log, 'utf8'), 'acme/widgets')).toBe('https://github.com/acme/widgets/pull/42');
  });

  it("writes the install's output as it is, then runs claude", async () => {
    const f = fixture({ lockfile: true });
    await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env });
    const log = readFileSync(f.files.log, 'utf8');
    expect(log.startsWith('$ pnpm install --frozen-lockfile\nLockfile is up to date\n{"type":"result"}\n')).toBe(true);
    expect(log).toContain('Bash: pnpm test');
  });

  it('writes the exit code of a failed run, and 127 when claude cannot be started', async () => {
    const failed = fixture({ exit: 3 });
    expect(await runJobProcess({ cwd: failed.cwd, files: failed.files, out: failed.out, env: failed.env })).toBe(3);
    expect(readFileSync(failed.files.exit, 'utf8')).toBe('3\n');
    const missing = fixture();
    expect(await runJobProcess({ cwd: missing.cwd, files: missing.files, out: missing.out, env: { PATH: join(missing.root, 'nowhere') } })).toBe(127);
    expect(readFileSync(missing.files.log, 'utf8')).toContain('claude: could not be started');
  });
});

// A repository's own skill (PRD 2313, s2): its job loads the repository's MCP servers from the
// worktree's `.mcp.json`, with no approval prompt; a fixed skill's job runs with the arguments it always had.
describe("runJobProcess, a repository's own skill", () => {
  const ARGS = ['--dangerously-skip-permissions', '-p', '--output-format', 'stream-json', '--verbose'];
  const argsOf = (root: string): string[] => readFileSync(join(root, 'args'), 'utf8').trim().split('\n');

  it('runs claude with --mcp-config .mcp.json when the worktree holds one', async () => {
    const f = fixture({ line: '/validate-prd 347', mcp: true });
    expect(await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env })).toBe(0);
    expect(argsOf(f.root)).toEqual([...ARGS, '--mcp-config', '.mcp.json']);
    expect(readFileSync(join(f.root, 'stdin'), 'utf8')).toBe('/validate-prd 347\n');
  });

  it('runs claude as before when the worktree holds no .mcp.json', async () => {
    const f = fixture({ line: '/validate-prd 347' });
    await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env });
    expect(argsOf(f.root)).toEqual(ARGS);
  });

  it("leaves a fixed skill's arguments unchanged, a .mcp.json in its worktree or not", async () => {
    const f = fixture({ line: '/omni:yolo 1717', mcp: true });
    await runJobProcess({ cwd: f.cwd, files: f.files, out: f.out, env: f.env });
    expect(argsOf(f.root)).toEqual(ARGS);
  });
});

describe('rawLogPath', () => {
  it('puts the raw stream beside the log', () => {
    expect(rawLogPath('/home/ada/logs/job-7.log')).toBe('/home/ada/logs/job-7.jsonl');
    expect(rawLogPath('/tmp/job')).toBe('/tmp/job.jsonl');
  });
});
