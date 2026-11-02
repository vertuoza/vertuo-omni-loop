// What a T3 run's process does (PRD 2537, s4, "Its command line, to run"): `omni runner t3-run`, which
// the `t3` agent's command starts in the job's worktree, the message on its standard input. It prints
// one line per thing it reads, for the job's log: the agent (`t3.ts`) turns each into readable lines.
//
// 1. A fresh run registers the job's worktree as a T3 project (`t3 project add <worktree>`), so T3
//    makes no worktree of its own; a worktree already one is fine.
// 2. It starts the thread on the account's instance and model in T3's Full access mode, the message on
//    stdin: `t3 thread start <worktree> - --provider <instance> --model <model> --wait --json`, or, to
//    resume a thread, `t3 thread send <thread> - --wait --json`. That call ends with the run, printing
//    `{threadId, runId, status, reply, error}`, and exits 0 (completed), 1 (failed, stopped, or T3
//    not running) or 2 (waiting for an answer).
// 3. Meanwhile, every tick (5 seconds), it finds the thread (`t3 thread list --project <worktree>`)
//    and follows it (`t3 thread show <thread> --json`): a `t3.show` line when its state changed, with
//    the assistant's new messages for an instance whose own files are not read; and it prints each
//    new line of a Claude instance's transcripts for the worktree, as Claude wrote it.
// 4. Asked to stop (SIGINT, in the command), it stops the thread through T3's MCP endpoint
//    (`t3-mcp.ts`) and waits for the run's end.
// 5. It prints the end as a `t3.end` line, T3's error words as they are, and removes the project
//    (`t3 project remove <worktree> --force`), unless the run was stopped: a stopped run is resumed for
//    its handoff note, whose own run removes it. Its exit code is T3's.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { field } from '../../ask/schema.ts';
import { projectFolder } from '../tokens.ts';

/** What one `t3` call came to: its exit code (127 when it could not be started) and its output. */
export type T3Result = { code: number; stdout: string; stderr: string };

/** Runs `t3 args` in `cwd`, `stdin` written to its standard input. */
export type T3Cli = (args: readonly string[], options: { cwd: string; stdin?: string | undefined }) => Promise<T3Result>;

/** How a stop is asked for, and how it is made. */
export type T3Stop = { signal: AbortSignal; interrupt(threadId: string): Promise<{ status: string } | { refused: string }> };

/** The `t3` on the PATH of `env` (this process's when not given). */
export function t3Cli(env?: Readonly<Record<string, string | undefined>>): T3Cli {
  return (args, { cwd, stdin }) => new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn('t3', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], ...(env === undefined ? {} : { env }) });
    } catch {
      resolve({ code: 127, stdout, stderr: 't3: could not be started' });
      return;
    }
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.stdin.on('error', () => {
      // A call that exits before reading its input leaves nothing to write it to.
    });
    child.stdin.end(stdin ?? '');
    child.on('error', () => {
      resolve({ code: 127, stdout, stderr: 't3: could not be started' });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** What a run is followed with. */
export type FollowT3 = {
  cwd: string;
  instance: string;
  model: string;
  /** The thread to resume, `null` for a fresh run. */
  thread: string | null;
  message: string;
  /** A Claude instance's projects folder, whose transcripts for the worktree are printed; `null` for another agent. */
  transcripts: string | null;
  /** Whether to print the assistant's new messages `thread show` gives. */
  messages: boolean;
  cli: T3Cli;
  print(line: string): void;
  tickMs?: number | undefined;
  now?: (() => number) | undefined;
  stop?: T3Stop | undefined;
};

/** How often a run is followed. */
const TICK_MS = 5000;

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const lines = (text: string): string[] => text.split('\n').map((line) => line.trimEnd()).filter((line) => line !== '');

/** The JSON object `text` holds, or `null`. */
function objectOf(text: string): object | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** The new whole lines of a Claude instance's transcripts for `cwd`, from where they stood when the run started. */
function transcriptTail(projects: string | null, cwd: string): () => string[] {
  if (projects === null) return () => [];
  const folder = join(projects, projectFolder(cwd));
  const files = (): string[] => {
    try {
      return readdirSync(folder).filter((name) => name.endsWith('.jsonl')).sort();
    } catch {
      return [];
    }
  };
  const sizeOf = (name: string): number => {
    try {
      return statSync(join(folder, name)).size;
    } catch {
      return 0;
    }
  };
  const read = new Map(files().map((name) => [name, sizeOf(name)]));
  return () => files().flatMap((name) => {
    const from = read.get(name) ?? 0;
    let text: string;
    try {
      text = readFileSync(join(folder, name)).subarray(from).toString('utf8');
    } catch {
      return [];
    }
    const end = text.lastIndexOf('\n');
    if (end < 0) return [];
    read.set(name, from + Buffer.byteLength(text.slice(0, end + 1)));
    return lines(text.slice(0, end));
  });
}

/** The thread of the worktree's project T3 started last, or `null`. */
async function threadOf(cli: T3Cli, cwd: string): Promise<string | null> {
  const listed = await cli(['thread', 'list', '--project', cwd, '--json'], { cwd });
  let threads: unknown;
  try {
    threads = JSON.parse(listed.stdout);
  } catch {
    return null;
  }
  if (listed.code !== 0 || !Array.isArray(threads)) return null;
  const newest = threads
    .map((thread: unknown) => ({ id: textOf(field(thread, 'threadId')), at: textOf(field(thread, 'createdAt')) }))
    .filter((thread) => thread.id !== '')
    .sort((left, right) => right.at.localeCompare(left.at))[0];
  return newest?.id ?? null;
}

/** One state of the thread, as `t3 thread show --json` gives it, and the assistant's messages it holds. */
function stateOf(shown: object): { key: string; line: Record<string, unknown>; said: string[] } {
  const thread = field(shown, 'thread');
  const messages = field(shown, 'messages');
  const said = Array.isArray(messages) ? messages.filter((message: unknown) => field(message, 'role') === 'assistant').map((message: unknown) => `${textOf(field(message, 'runId'))}\n${textOf(field(message, 'text'))}`) : [];
  const line = {
    type: 't3.show',
    status: textOf(field(thread, 'status')),
    activeRunId: field(thread, 'activeRunId') ?? null,
    pendingRequestCount: field(thread, 'pendingRequestCount') ?? 0,
    itemCount: field(thread, 'itemCount') ?? 0,
  };
  return { key: JSON.stringify(line), line, said };
}

/** Follows the thread: prints its state when it changed, with the new messages when asked to. */
function follower(options: FollowT3) {
  let last = '';
  const seen = new Set<string>();
  return async (thread: string): Promise<void> => {
    const shown = await options.cli(['thread', 'show', thread, '--json'], { cwd: options.cwd });
    const object = shown.code === 0 ? objectOf(shown.stdout) : null;
    if (object === null) return;
    const state = stateOf(object);
    const fresh = options.messages ? state.said.filter((message) => !seen.has(message)) : [];
    for (const message of state.said) seen.add(message);
    if (state.key === last && fresh.length === 0) return;
    last = state.key;
    options.print(JSON.stringify({ ...state.line, messages: fresh.map((message) => message.slice(message.indexOf('\n') + 1)) }));
  };
}

/** Registers the worktree as a project; `null` once it is one, else the result to end on. */
async function addProject(cli: T3Cli, cwd: string): Promise<T3Result | null> {
  const added = await cli(['project', 'add', cwd], { cwd });
  if (added.code === 0 || /already exists/.test(added.stderr + added.stdout)) return null;
  return added;
}

/** Prints what a `t3` call said: its JSON end as `t3.end`, anything else as it is. Answers the end's status. */
function printEnd(options: FollowT3, ended: T3Result, started: number): string | null {
  const now = options.now ?? Date.now;
  const end = objectOf(ended.stdout.trim());
  if (end !== null && textOf(field(end, 'status')) !== '') {
    const at = now();
    options.print(JSON.stringify({ type: 't3.end', ...end, at: new Date(at).toISOString(), ms: Math.max(0, at - started) }));
  } else {
    for (const line of lines(ended.stdout)) options.print(line);
  }
  for (const line of lines(ended.stderr)) options.print(line);
  return end === null ? null : textOf(field(end, 'status'));
}

/** The call that runs: a fresh thread on the instance and model, or one more message to the thread resumed. */
const runArgs = ({ cwd, thread, instance, model }: FollowT3): string[] => (thread === null
  ? ['thread', 'start', cwd, '-', '--provider', instance, '--model', model, '--wait', '--json']
  : ['thread', 'send', thread, '-', '--wait', '--json']);

/** A promise that never settles: no stop to wait for. */
const NEVER = new Promise<false>(() => undefined);

/** Settles `false` once `signal` is aborted. */
const abortOf = (signal: AbortSignal): Promise<false> => new Promise((resolve) => {
  if (signal.aborted) resolve(false);
  signal.addEventListener('abort', () => { resolve(false); }, { once: true });
});

/** The thread a run follows, named once found, and the stop made once asked. */
function threadWatcher(options: FollowT3) {
  const follow = follower(options);
  let thread = options.thread;
  let stopped = false;
  const named = (id: string): void => {
    options.print(JSON.stringify({ type: 't3.thread', threadId: id, instance: options.instance, model: options.model }));
  };
  if (thread !== null) named(thread);
  return {
    /** Whether the stop was made: none is waited for after it. */
    stopped: () => stopped,
    /** One tick: the thread found, followed, and stopped when asked. */
    async tick(): Promise<void> {
      if (thread === null) {
        thread = await threadOf(options.cli, options.cwd);
        if (thread === null) return;
        named(thread);
      }
      await follow(thread);
      if (options.stop?.signal.aborted !== true || stopped) return;
      stopped = true;
      options.print(JSON.stringify({ type: 't3.interrupt', threadId: thread, ...(await options.stop.interrupt(thread)) }));
    },
  };
}

/** Follows the run until it ends: a tick each `tickMs`, or at once when a stop is asked. */
async function watch(options: FollowT3, run: Promise<T3Result>, tail: () => string[]): Promise<void> {
  const done = run.then(() => true);
  const asked = options.stop === undefined ? NEVER : abortOf(options.stop.signal);
  const watcher = threadWatcher(options);
  for (;;) {
    const ended = await Promise.race([done, delay(options.tickMs ?? TICK_MS).then(() => false), watcher.stopped() ? NEVER : asked]);
    for (const line of tail()) options.print(line);
    if (ended) return;
    await watcher.tick();
  }
}

/** Runs and follows one T3 run to its end: answers `t3`'s exit code. */
export async function followT3(options: FollowT3): Promise<number> {
  const { cwd, cli } = options;
  const started = (options.now ?? Date.now)();
  const tail = transcriptTail(options.transcripts, cwd);
  const refused = options.thread === null ? await addProject(cli, cwd) : null;
  if (refused !== null) {
    for (const line of [...lines(refused.stdout), ...lines(refused.stderr)]) options.print(line);
    return refused.code === 0 ? 1 : refused.code;
  }
  const run = cli(runArgs(options), { cwd, stdin: options.message });
  await watch(options, run, tail);
  const result = await run;
  const status = printEnd(options, result, started);
  if (status !== null && status !== 'interrupted') await cli(['project', 'remove', cwd, '--force'], { cwd });
  return result.code;
}
