// What runs inside a job's tmux session (PRD 1830, "Each job"; PRD 1904, "One readable line per
// step"): `pnpm install --frozen-lockfile` when the worktree has a lockfile, then the job's run on its
// account, through that account's agent (PRD 2537, `agents/`): the agent says which program runs, with
// which arguments, variables and standard input, the job's line among them, read from a file: no
// shell ever sees the line. The run prints one line per event; the agent turns each into its readable
// lines, written to the job's log and to the session, for a person attached to it, while the raw
// output goes to `job-<id>.jsonl` beside the log and never leaves the machine. The install's output
// and the run's standard error are written as they are. The exit code goes to a file of its own once
// the run ends, which is how the runner learns it ended. A job with no account given runs on the
// fallback agent's one account, as every job ran before there were accounts.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { processEnv } from '../env/read.ts';
import type { Agent, AgentAccount, RunCommand } from './agents/agent.ts';
import { fallbackAccount, fallbackAgent } from './agents/index.ts';
import type { Out } from './runner.ts';

/** The files a job's run reads and writes. */
export type JobFiles = { line: string; log: string; exit: string };

/** The lockfile whose presence makes the run install first. */
const LOCKFILE = 'pnpm-lock.yaml';

/** Where a job's raw stream goes: its log's path with `.jsonl` for `.log`. */
export function rawLogPath(log: string): string {
  return `${log.replace(/\.log$/, '')}.jsonl`;
}

/** The variables a process starts with. */
type Variables = Readonly<Record<string, string | undefined>>;

/** What one run writes: the log and the pane, each chunk of its standard output, and its variables. */
type RunTo = { cwd: string; stdin: string | null; log: string; out: Out; env?: Variables | undefined; stdout?: (chunk: Buffer) => void };

/** Runs `file args` in `cwd`, `stdin` written to its standard input; its standard output goes to `stdout` when given, else as it is, its standard error as it is. Answers its exit code. */
function run(file: string, args: readonly string[], { cwd, stdin, log, out, env, stdout }: RunTo): Promise<number> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(file, args, { cwd, stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'], ...(env ? { env } : {}) });
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
    child.stdin?.on('error', () => {
      // A run that exits before reading its input leaves nothing to write it to.
    });
    if (stdin !== null) child.stdin?.end(stdin);
    child.on('error', () => {
      appendFileSync(log, `${file}: could not be started\n`);
      resolve(127);
    });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

/** Reads a run's standard output whole lines at a time: each raw to `raw`, its readable lines, as `agent` reads them, to the log and the pane. */
function streamReader({ agent, log, raw, out }: { agent: Agent; log: string; raw: string; out: Out }): { chunk(data: Buffer): void; end(): void } {
  const context = { seen: new Set<string>() };
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const emit = (line: string): void => {
    const lines = agent.step(line, context);
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

/** The variables a run starts with: the job's (`env`, else this process's), plus the ones its command adds. */
function runEnv(env: Readonly<Record<string, string>> | undefined, command: RunCommand): Variables | undefined {
  if (Object.keys(command.env).length === 0) return env;
  return { ...(env ?? processEnv()), ...command.env };
}

/**
 * The job's run in `cwd`: the install when there is a lockfile, then the run of `account` through
 * `agent` (the fallback agent's one account, unless given). Writes the exit code last. `env`, when
 * given, is the variables both run with in place of the runner's own.
 */
export async function runJobProcess({ cwd, files, out, env, agent = fallbackAgent(), account = fallbackAccount() }: {
  cwd: string;
  files: JobFiles;
  out: Out;
  env?: Readonly<Record<string, string>>;
  agent?: Agent;
  account?: AgentAccount;
}): Promise<number> {
  let code = 0;
  if (existsSync(join(cwd, LOCKFILE))) {
    appendFileSync(files.log, '$ pnpm install --frozen-lockfile\n');
    code = await run('pnpm', ['install', '--frozen-lockfile'], { cwd, stdin: null, log: files.log, out, env });
  }
  if (code === 0) {
    const raw = rawLogPath(files.log);
    writeFileSync(raw, '');
    const reader = streamReader({ agent, log: files.log, raw, out });
    const command = agent.command({ line: readFileSync(files.line, 'utf8').replace(/\n$/, ''), cwd }, account);
    try {
      code = await run(command.file, command.args, { cwd, stdin: command.stdin, log: files.log, out, env: runEnv(env, command), stdout: (chunk) => { reader.chunk(chunk); } });
    } finally {
      reader.end();
    }
  }
  writeFileSync(files.exit, `${String(code)}\n`);
  return code;
}
