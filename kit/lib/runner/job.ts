// What runs inside a job's tmux session (PRD 1830, "Each job"; PRD 1904, "One readable line per
// step"): `pnpm install --frozen-lockfile` when the worktree has a lockfile, then
// `claude --dangerously-skip-permissions -p --output-format stream-json --verbose`, the job's line on
// its standard input, read from a file: no shell ever sees the line. claude prints one JSON event per
// line; each becomes its readable lines (`steps.ts`), written to the job's log and to the session,
// for a person attached to it, while the raw stream goes to `job-<id>.jsonl` beside the log and never
// leaves the machine. The install's output and claude's standard error are written as they are. The
// exit code goes to a file of its own once the run ends, which is how the runner learns it ended.
// A job of a repository's own skill whose worktree holds `.mcp.json` runs claude with
// `--mcp-config .mcp.json` too (PRD 2313), so the repository's MCP servers load with no prompt.
import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { checkRunnerLine } from './line.ts';
import type { Out } from './runner.ts';
import { stepLine } from './steps.ts';

/** The files a job's run reads and writes. */
export type JobFiles = { line: string; log: string; exit: string };

/** The lockfile whose presence makes the run install first. */
const LOCKFILE = 'pnpm-lock.yaml';

/** The arguments claude runs a job with: unattended, printing one JSON event per line. */
const CLAUDE_ARGS: readonly string[] = ['--dangerously-skip-permissions', '-p', '--output-format', 'stream-json', '--verbose'];

/** The MCP servers a repository declares, in its worktree's root. */
const MCP_CONFIG = '.mcp.json';

/**
 * The arguments claude runs the job on `line` with in `cwd`. A line of a repository's own skill (PRD 2313)
 * — any line but a fixed skill's, since the runner let nothing else through — loads the repository's MCP
 * servers when the worktree holds `.mcp.json`; allowing the skill allowed them. A fixed skill's are as ever.
 */
function claudeArgs(cwd: string, line: string): readonly string[] {
  if (checkRunnerLine(line).ok || !existsSync(join(cwd, MCP_CONFIG))) return CLAUDE_ARGS;
  return [...CLAUDE_ARGS, '--mcp-config', MCP_CONFIG];
}

/** Where a job's raw stream goes: its log's path with `.jsonl` for `.log`. */
export function rawLogPath(log: string): string {
  return `${log.replace(/\.log$/, '')}.jsonl`;
}

/** What one run writes: the log and the pane, each chunk of its standard output, and its variables. */
type RunTo = { cwd: string; stdin: number | 'ignore'; log: string; out: Out; env?: Readonly<Record<string, string>> | undefined; stdout?: (chunk: Buffer) => void };

/** Runs `file args` in `cwd`; its standard output goes to `stdout` when given, else as it is, its standard error as it is. Answers its exit code. */
function run(file: string, args: readonly string[], { cwd, stdin, log, out, env, stdout }: RunTo): Promise<number> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(file, args, { cwd, stdio: [stdin, 'pipe', 'pipe'], ...(env ? { env } : {}) });
    } catch {
      resolve(127);
      return;
    }
    const write = (chunk: Buffer): void => {
      appendFileSync(log, chunk);
      out.write(chunk.toString('utf8'));
    };
    child.stdout?.on('data', stdout ?? write);
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

/** Reads claude's standard output whole lines at a time: each raw to `raw`, its readable lines to the log and the pane. */
function streamReader({ log, raw, out }: { log: string; raw: string; out: Out }): { chunk(data: Buffer): void; end(): void } {
  const seen = new Set<string>();
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const emit = (line: string): void => {
    const lines = stepLine(line, { seen });
    if (lines.length === 0) return;
    const text = `${lines.join('\n')}\n`;
    appendFileSync(log, text);
    out.write(text);
  };
  return {
    chunk(data) {
      appendFileSync(raw, data);
      const parts = (pending + decoder.write(data)).split('\n');
      pending = parts.pop() ?? '';
      for (const line of parts) emit(line);
    },
    end() {
      pending += decoder.end();
      if (pending !== '') emit(pending);
      pending = '';
    },
  };
}

/**
 * The job's run in `cwd`: the install when there is a lockfile, then `claude`. Writes the exit code
 * last. `env`, when given, is the variables both run with in place of the runner's own.
 */
export async function runJobProcess({ cwd, files, out, env }: { cwd: string; files: JobFiles; out: Out; env?: Readonly<Record<string, string>> }): Promise<number> {
  let code = 0;
  if (existsSync(join(cwd, LOCKFILE))) {
    appendFileSync(files.log, '$ pnpm install --frozen-lockfile\n');
    code = await run('pnpm', ['install', '--frozen-lockfile'], { cwd, stdin: 'ignore', log: files.log, out, env });
  }
  if (code === 0) {
    const raw = rawLogPath(files.log);
    writeFileSync(raw, '');
    const reader = streamReader({ log: files.log, raw, out });
    const args = claudeArgs(cwd, readFileSync(files.line, 'utf8').replace(/\n$/, ''));
    const stdin = openSync(files.line, 'r');
    try {
      code = await run('claude', args, { cwd, stdin, log: files.log, out, env, stdout: (chunk) => { reader.chunk(chunk); } });
    } finally {
      reader.end();
      closeSync(stdin);
    }
  }
  writeFileSync(files.exit, `${String(code)}\n`);
  return code;
}
