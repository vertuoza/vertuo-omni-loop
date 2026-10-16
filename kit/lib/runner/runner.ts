// `omni runner`'s loop (PRD 1830, "omni runner"): register with the Omni app, keep one `next` open per
// free slot, and run each job it hands over — in a worktree `~/wt/<repo>-job-<id>` on its own branch
// `agent/job-<id>`, in a tmux session `job-<id>`, logged to `~/logs/job-<id>.log` — sending its log
// tail every few seconds until it ends, is cancelled or runs past the timeout. Then the worktree goes,
// the branch too unless it was pushed, and `git worktree prune` runs in the checkout (PRD 1911).
//
// A sweep (`sweep.ts`) runs once the runner has registered, then every hour while it runs: it removes
// the worktrees, unpushed branches and old logs (`--keep-logs` days) of jobs no slot holds. It also
// updates the Omni plugin, and before each job the runner brings the plugin up to the omni the job's
// repository pins, or fails the job with the reason before Claude starts (`plugin.ts`, PRD 2100).
//
// Each report also carries the log's lines after the job's cursor (PRD 1904, "Only the new lines are
// sent"): the cursor is the last line the app accepted, and moves only when it answers, so a report
// that fails sends the same lines again. One report carries at most 2,000 lines and 256 KB; the rest
// waits for the next tick, and once the job ends `finish()` sends every line left before its status.
//
// The app unreachable: every call is tried again after 5 s, doubling up to 60 s, and the running jobs
// keep going. The sign-in refused: the runner stops taking jobs and ends on one line. Stopped
// (Ctrl-C): it stops taking jobs and waits for the running ones.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecText } from '../context.ts';
import { runningBundle } from '../init/bundle.ts';
import { RunnerRefused, RunnerUnreachable } from './api.ts';
import type { JobUpdate, RunnerApi, RunnerJob } from './api.ts';
import { checkLine } from './line.ts';
import { lastPullRequest, linesAfter, logTail, reportBatch } from './log.ts';
import { pluginKeeper } from './plugin.ts';
import type { PluginKeeper } from './plugin.ts';
import { dropJobBranch, pruneWorktrees, sweep, sweptLine } from './sweep.ts';
import type { Terminal } from './terminal.ts';

/** Where the runner prints: `process.stdout`, or a test's buffer. */
export type Out = { write(text: string): unknown };

/** How long the runner waits between two looks at a running job. */
const TICK_MS = 5000;
/** The first wait after the app did not answer, doubled each time up to 60 s. */
const BACKOFF = { firstMs: 5000, maxMs: 60_000 };
/** How many times a job's last status is sent before the runner gives up on it. */
const FINAL_TRIES = 8;
/** How long the runner waits between two sweeps. */
const SWEEP_MS = 60 * 60 * 1000;
/** How many days a stopped job's logs are kept, unless `--keep-logs` says otherwise. */
export const KEEP_LOGS_DAYS = 14;

/** Waits `ms`, or less when `signal` aborts. */
const sleepFor = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
    if (signal?.aborted) done();
  });

export type RunnerOptions = {
  name: string;
  slots: number;
  timeoutMs: number;
  version: string | null;
  /** The checkouts the runner holds, by `owner/name`. */
  checkouts: ReadonlyMap<string, string>;
  api: RunnerApi;
  terminal: Terminal;
  exec: ExecText;
  /** Where `wt/` and `logs/` live: the person's home. */
  home: string;
  /** The command that runs a job inside its session, before its own flags. */
  wrapper: readonly string[];
  /** The variables every job's session gets, beside the sender's. */
  env: Readonly<Record<string, string>>;
  print(line: string): void;
  /** Aborted to stop the runner: it takes no more jobs and waits for the running ones. */
  stop: AbortSignal;
  now?: (() => number) | undefined;
  sleep?: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
  tickMs?: number | undefined;
  backoff?: { firstMs: number; maxMs: number } | undefined;
  /** How many days a stopped job's logs are kept: `KEEP_LOGS_DAYS` unless given. */
  keepLogsDays?: number | undefined;
};

/** One runner's state while it runs: its options with their defaults, and whether it was refused. */
type Loop = RunnerOptions & {
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  tickMs: number;
  firstMs: number;
  maxMs: number;
  /** Aborted once the runner is stopped or refused: no more jobs are taken. */
  halt: AbortSignal;
  refuse(error: RunnerRefused): void;
  refused(): string | null;
  running: number;
  /** The ids of the jobs a slot holds: the sweep leaves everything of theirs alone. */
  jobs: Set<string>;
  /** The Omni plugin's care: the check before each job, and the update of the sweep. */
  plugin: PluginKeeper;
};

/** A job's live lines: its log, and how many of its lines the app has accepted. */
type Live = { log: string; cursor: number };

/** `update` with the next lines of `live` after its cursor, when there are any. */
function withLines(update: JobUpdate, live: Live, lines: readonly string[]): JobUpdate {
  return lines.length === 0 ? update : { ...update, from: live.cursor + 1, lines: [...lines] };
}

/** Where a job runs and what it writes. */
type Place = { checkout: string; worktree: string; session: string; line: string; log: string; exit: string };

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };

const readText = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

function loopOf(options: RunnerOptions): Loop {
  const refusal = new AbortController();
  let refused: string | null = null;
  const { firstMs, maxMs } = options.backoff ?? BACKOFF;
  return {
    ...options,
    now: options.now ?? Date.now,
    sleep: options.sleep ?? sleepFor,
    tickMs: options.tickMs ?? TICK_MS,
    firstMs,
    maxMs,
    halt: AbortSignal.any([options.stop, refusal.signal]),
    refuse(error) {
      refused ??= error.message;
      refusal.abort();
    },
    refused: () => refused,
    running: 0,
    jobs: new Set(),
    plugin: pluginKeeper({ exec: options.exec, running: { version: options.version }, bundle: runningBundle(), print: (line) => { options.print(line); } }),
  };
}

/** Waits before the next try, after the app did not answer: answers the wait after this one. */
async function backOff(loop: Loop, delay: number, error: RunnerUnreachable, signal?: AbortSignal): Promise<number> {
  loop.print(`the app is unreachable (${error.message}): trying again in ${String(Math.round(delay / 1000))} s`);
  await loop.sleep(delay, signal);
  return Math.min(delay * 2, loop.maxMs);
}

/** Registers, trying again while the app does not answer: the runner's id, or `null` when stopped or refused. */
async function register(loop: Loop): Promise<string | null> {
  let delay = loop.firstMs;
  const repos = [...loop.checkouts.keys()];
  while (!loop.halt.aborted) {
    try {
      return (await loop.api.register({ name: loop.name, slots: loop.slots, repos, version: loop.version ?? 'unknown' })).id;
    } catch (error) {
      if (error instanceof RunnerRefused) loop.refuse(error);
      else if (error instanceof RunnerUnreachable) delay = await backOff(loop, delay, error, loop.halt);
      else throw error;
    }
  }
  return null;
}

/**
 * Sends a running job's status, with the lines after the cursor: a cancel waiting comes back true.
 * The cursor moves only once the app answers. The app not answering is no cancel.
 */
async function tick(loop: Loop, job: string, update: JobUpdate, live?: Live, log = ''): Promise<boolean> {
  const lines = live ? reportBatch(linesAfter(log, live.cursor, { ended: false })) : [];
  try {
    const { cancel } = await loop.api.update(job, live ? withLines(update, live, lines) : update);
    if (live) live.cursor += lines.length;
    return cancel;
  } catch (error) {
    if (error instanceof RunnerRefused) loop.refuse(error);
    else if (!(error instanceof RunnerUnreachable)) throw error;
    return false;
  }
}

/** Sends one of a job's last reports, trying again while the app does not answer: whether it went. */
async function sendLast(loop: Loop, job: string, update: JobUpdate): Promise<boolean> {
  let wait = loop.firstMs;
  for (let tries = 1; tries <= FINAL_TRIES; tries += 1) {
    try {
      await loop.api.update(job, update);
      return true;
    } catch (error) {
      if (error instanceof RunnerRefused) {
        loop.refuse(error);
        return false;
      }
      if (!(error instanceof RunnerUnreachable) || tries === FINAL_TRIES) return false;
      wait = await backOff(loop, wait, error);
    }
  }
  return false;
}

/**
 * Sends every line of the job's log left after the cursor, the last one too, in as many reports as
 * it takes, then its last status, which carries the last of them.
 */
async function finish(loop: Loop, job: string, update: JobUpdate, live: Live | null): Promise<void> {
  if (live === null) {
    await sendLast(loop, job, update);
    return;
  }
  const log = readText(live.log);
  const left = linesAfter(log, live.cursor, { ended: true });
  for (;;) {
    const lines = reportBatch(left);
    const last = lines.length === left.length;
    const report = last ? update : { status: 'running' as const, logTail: logTail(log) };
    if (!(await sendLast(loop, job, withLines(report, live, lines))) || last) return;
    live.cursor += lines.length;
    left.splice(0, lines.length);
  }
}

/** The branch the checkout's `origin` starts from: its `HEAD`, else `main`. */
function defaultBranch(exec: ExecText, checkout: string): string {
  try {
    return exec('git', ['-C', checkout, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], QUIET).trim().replace(/^origin\//, '');
  } catch {
    // No `origin/HEAD` recorded: ask the remote.
  }
  try {
    const out = exec('git', ['-C', checkout, 'ls-remote', '--symref', 'origin', 'HEAD'], QUIET);
    return /^ref: refs\/heads\/(\S+)\s+HEAD/m.exec(out)?.[1] ?? 'main';
  } catch {
    return 'main';
  }
}

/** Where `job` runs, or the status it ends on before it runs: a line refused, a repository not held. */
function placeOf(loop: Loop, job: RunnerJob): Place | JobUpdate {
  const line = checkLine(job.line);
  if (!line.ok) return { status: 'failed', reason: `refused: ${line.reason}` };
  const checkout = loop.checkouts.get(job.repo);
  if (checkout === undefined) return { status: 'failed', reason: `${job.repo} is not held by this runner` };
  const repoName = job.repo.split('/').at(-1) ?? job.repo;
  const logs = join(loop.home, 'logs');
  return {
    checkout,
    worktree: join(loop.home, 'wt', `${repoName}-job-${job.id}`),
    session: `job-${job.id}`,
    line: join(logs, `job-${job.id}.line`),
    log: join(logs, `job-${job.id}.log`),
    exit: join(logs, `job-${job.id}.exit`),
  };
}

/** Fetches, then adds the job's worktree on its own branch from the default branch: whether it worked. */
function makeWorktree(loop: Loop, job: RunnerJob, place: Place): boolean {
  try {
    loop.exec('git', ['-C', place.checkout, 'fetch', 'origin'], QUIET);
    const base = defaultBranch(loop.exec, place.checkout);
    mkdirSync(join(loop.home, 'wt'), { recursive: true });
    loop.exec('git', ['-C', place.checkout, 'worktree', 'add', '--no-track', '-b', `agent/job-${job.id}`, place.worktree, `origin/${base}`], QUIET);
    return true;
  } catch {
    return false;
  }
}

/** Removes the job's worktree, the records left stale, then its branch unless it was pushed. */
function cleanUp(loop: Loop, job: RunnerJob, place: Place): void {
  try {
    loop.exec('git', ['-C', place.checkout, 'worktree', 'remove', '--force', place.worktree], QUIET);
  } catch {
    rmSync(place.worktree, { recursive: true, force: true });
  }
  pruneWorktrees(loop.exec, place.checkout);
  dropJobBranch(loop.exec, place.checkout, `agent/job-${job.id}`);
}

/** `claude -p` stops the background agents a wave starts 10 minutes after its last turn, then exits 0;
 * 0 makes it wait for them to end (bug 1912). */
const WAIT_FOR_AGENTS: Readonly<Record<string, string>> = { CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' };

/** Writes the job's line and its log, empty or starting on `note`, then starts its session: whether it started. */
function startSession(loop: Loop, job: RunnerJob, place: Place, note: string | null): boolean {
  mkdirSync(join(loop.home, 'logs'), { recursive: true });
  writeFileSync(place.line, `${job.line}\n`);
  writeFileSync(place.log, note === null ? '' : `${note}\n`);
  rmSync(place.exit, { force: true });
  const sender: Record<string, string> = job.sentBy ? { OMNI_SENT_BY: job.sentBy, OMNI_RUNNER: loop.name } : {};
  try {
    loop.terminal.start({
      name: place.session,
      cwd: place.worktree,
      env: { ...loop.env, ...sender, ...WAIT_FOR_AGENTS },
      argv: [...loop.wrapper, '--line', place.line, '--log', place.log, '--exit', place.exit],
    });
    return true;
  } catch {
    return false;
  }
}

/** The status a run that ended with `exitText` reports: done with its pull request, or failed with its code. */
function ended(log: string, exitText: string, repo: string): JobUpdate {
  const code = Number.parseInt(exitText, 10);
  const exitCode = Number.isNaN(code) ? 1 : code;
  if (exitCode === 0) return { status: 'done', logTail: logTail(log), prUrl: lastPullRequest(log, repo), exitCode: 0 };
  return { status: 'failed', logTail: logTail(log), exitCode, reason: `exit code ${String(exitCode)}` };
}

/** Stops the job's session and answers `update`. */
function killed(loop: Loop, place: Place, update: JobUpdate): JobUpdate {
  loop.terminal.stop(place.session);
  return { ...update, logTail: logTail(readText(place.log)) };
}

/** Looks at the running job every tick, until it ends, is cancelled or runs past the timeout. */
async function watch(loop: Loop, job: RunnerJob, place: Place, live: Live): Promise<JobUpdate> {
  const started = loop.now();
  if (await tick(loop, job.id, { status: 'running', logTail: '' })) return killed(loop, place, { status: 'cancelled' });
  for (;;) {
    await loop.sleep(loop.tickMs);
    const log = readText(place.log);
    if (existsSync(place.exit)) return ended(log, readText(place.exit), job.repo);
    if (!loop.terminal.alive(place.session)) return { status: 'failed', logTail: logTail(log), reason: 'the job stopped before it wrote its exit code' };
    if (loop.now() - started > loop.timeoutMs) return killed(loop, place, { status: 'failed', reason: 'timeout' });
    if (await tick(loop, job.id, { status: 'running', logTail: logTail(log) }, live, log)) return killed(loop, place, { status: 'cancelled' });
  }
}

/** Runs `job` to its end, and answers its last status and its live lines, once it has a log. */
async function runJob(loop: Loop, job: RunnerJob): Promise<{ last: JobUpdate; live: Live | null }> {
  const place = placeOf(loop, job);
  if ('status' in place) return { last: place, live: null };
  if (!makeWorktree(loop, job, place)) return { last: { status: 'failed', reason: 'the worktree could not be made' }, live: null };
  try {
    const plugin = await loop.plugin.forJob(place.worktree, job.repo);
    if ('failed' in plugin) return { last: { status: 'failed', reason: plugin.failed }, live: null };
    if (!startSession(loop, job, place, plugin.note)) return { last: { status: 'failed', reason: 'the tmux session could not be started' }, live: null };
    const live: Live = { log: place.log, cursor: 0 };
    return { last: await watch(loop, job, place, live), live };
  } finally {
    cleanUp(loop, job, place);
  }
}

/** The line a job's end prints. */
function endLine(job: RunnerJob, last: JobUpdate): string {
  const detail = last.status === 'done' ? last.prUrl : last.reason;
  return `job ${job.id} ${last.status}${detail ? ` · ${detail}` : ''}`;
}

/** Waits for the next job: the job, `null` for none yet, or `stop` once the runner stops. */
async function nextJob(loop: Loop, runner: string, wait: { ms: number }): Promise<RunnerJob | null | 'stop'> {
  try {
    const job = await loop.api.next(runner, loop.halt);
    wait.ms = loop.firstMs;
    return job;
  } catch (error) {
    if (loop.halt.aborted) return 'stop';
    if (error instanceof RunnerRefused) {
      loop.refuse(error);
      return 'stop';
    }
    if (!(error instanceof RunnerUnreachable)) throw error;
    wait.ms = await backOff(loop, wait.ms, error, loop.halt);
    return null;
  }
}

/** One slot: waits for a job, runs it, and again, until the runner stops. */
async function slot(loop: Loop, runner: string): Promise<void> {
  const wait = { ms: loop.firstMs };
  while (!loop.halt.aborted) {
    const job = await nextJob(loop, runner, wait);
    if (job === 'stop') return;
    if (job === null) continue;
    loop.running += 1;
    loop.jobs.add(job.id);
    loop.print(`job ${job.id} claimed: ${job.line} (${job.repo})`);
    try {
      const { last, live } = await runJob(loop, job);
      await finish(loop, job.id, last, live);
      loop.print(endLine(job, last));
    } finally {
      loop.jobs.delete(job.id);
      loop.running -= 1;
    }
  }
}

/** Sweeps now and updates the Omni plugin, then every hour, until the runner stops or is refused. */
async function sweeper(loop: Loop): Promise<void> {
  const keepLogsDays = loop.keepLogsDays ?? KEEP_LOGS_DAYS;
  while (!loop.halt.aborted) {
    const line = sweptLine(sweep({ home: loop.home, checkouts: loop.checkouts, exec: loop.exec, running: loop.jobs, keepLogsDays, now: loop.now() }));
    if (line !== null) loop.print(line);
    await loop.plugin.sweep();
    await loop.sleep(SWEEP_MS, loop.halt);
  }
}

/** Runs the runner until it is stopped or refused: 0 once stopped, 1 when refused. */
export async function runRunner(options: RunnerOptions): Promise<number> {
  const loop = loopOf(options);
  const runner = await register(loop);
  if (runner !== null) {
    const repos = [...loop.checkouts.keys()].join(', ') || 'no repository';
    loop.print(`runner ${loop.name} registered · ${String(loop.slots)} slot${loop.slots === 1 ? '' : 's'} · ${repos}`);
    const onStop = (): void => {
      if (loop.running > 0) loop.print(`stopping: waiting for ${String(loop.running)} running job${loop.running === 1 ? '' : 's'}`);
    };
    options.stop.addEventListener('abort', onStop, { once: true });
    await Promise.all([sweeper(loop), ...Array.from({ length: loop.slots }, () => slot(loop, runner))]).finally(() => {
      options.stop.removeEventListener('abort', onStop);
    });
  }
  const refused = loop.refused();
  loop.print(refused ?? `runner ${loop.name} stopped`);
  return refused === null ? 0 : 1;
}
