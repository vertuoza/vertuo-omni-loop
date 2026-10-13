// What runs inside a job's tmux session (PRD 1830, "Each job"): `pnpm install --frozen-lockfile` when
// the worktree has a lockfile, then `claude --dangerously-skip-permissions -p`, the job's line on its
// standard input, read from a file: no shell ever sees the line. Everything both print goes to the
// job's log, and to the session, for a person attached to it. The exit code goes to a file of its
// own once the run ends, which is how the runner learns it ended.
import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Out } from './runner.ts';

/** The files a job's run reads and writes. */
export type JobFiles = { line: string; log: string; exit: string };

/** The lockfile whose presence makes the run install first. */
const LOCKFILE = 'pnpm-lock.yaml';

/** Runs `file args` in `cwd`, its output appended to `log` and written to `out`; answers its exit code. */
function run(file: string, args: readonly string[], { cwd, stdin, log, out }: { cwd: string; stdin: number | 'ignore'; log: string; out: Out }): Promise<number> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(file, args, { cwd, stdio: [stdin, 'pipe', 'pipe'] });
    } catch {
      resolve(127);
      return;
    }
    const write = (chunk: Buffer): void => {
      appendFileSync(log, chunk);
      out.write(chunk.toString('utf8'));
    };
    child.stdout?.on('data', write);
    child.stderr?.on('data', write);
    child.on('error', () => {
      appendFileSync(log, `${file}: could not be started\n`);
      resolve(127);
    });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

/** The job's run in `cwd`: the install when there is a lockfile, then `claude`. Writes the exit code last. */
export async function runJobProcess({ cwd, files, out }: { cwd: string; files: JobFiles; out: Out }): Promise<number> {
  let code = 0;
  if (existsSync(join(cwd, LOCKFILE))) {
    appendFileSync(files.log, '$ pnpm install --frozen-lockfile\n');
    code = await run('pnpm', ['install', '--frozen-lockfile'], { cwd, stdin: 'ignore', log: files.log, out });
  }
  if (code === 0) {
    const stdin = openSync(files.line, 'r');
    try {
      code = await run('claude', ['--dangerously-skip-permissions', '-p'], { cwd, stdin, log: files.log, out });
    } finally {
      closeSync(stdin);
    }
  }
  writeFileSync(files.exit, `${String(code)}\n`);
  return code;
}
