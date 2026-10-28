// `omni runner`'s loop (PRD 1830, "omni runner"): register with the Omni app, keep one `next` open per
// free slot, and run each job it hands over — in a worktree `~/wt/<repo>-job-<id>` on its own branch
// `agent/job-<id>`, in a tmux session `job-<id>`, logged to `~/logs/job-<id>.log` — sending its log
// tail every few seconds until it ends, is cancelled or runs past the timeout. Then the worktree goes,
// the branch too unless it was pushed, and `git worktree prune` runs in the checkout (PRD 1911).
//
// Once registered, it samples its machine every 15 s and sends the sample to the app (PRD 2102,
// `health.ts`). A report the app refuses or never answers within 5 s prints one line, and nothing else
// changes: the runner keeps taking and running jobs.
//
// Tokens (PRD 2102, `tokens.ts`): each health report carries the machine's tokens of the last 5 h and
// of today, and each job's report the tokens of its worktree and every folder below it, counted from
// Claude's transcripts. A job report carries them only once the health route has answered 2xx (an
// older app's strict job contract would refuse them), and a job report the app refuses for them is
// sent again without, and the runner stops sending them. A count that cannot be read is left out.
//
// A sample under pressure (memory, disk or load past the runner's limits) pauses the runner: it prints
// `paused: <reason>` and its free slots open no new `next`. A slot already waiting on `next` keeps its
// hold and runs the job it gets, and a running job is never touched. Two quiet samples in a row resume
// it: it prints `resumed` and the free slots open their `next` again. Each report carries the reason
// (`paused`, `null` when running) and the limits. The pause is decided here, whatever the app answers.
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
//
// Each job's session gets `OMNI_JOB`, `OMNI_RUNNER` and `OMNI_UNATTENDED` (PRD 2175), so a claim it
// makes names its job. Once a job ends, done, failed, timed out or cancelled, the runner releases the
// claims it still holds (`release.ts`), and the job's last report carries `released` and
// `releaseError`. A job no slot holds whose worktree the sweep finds was marked lost by the app: its
// claims are released too, reason `runner lost`, and a report carrying only what was released follows
// when there is something to say. An app that refuses those two fields gets the report again without
// them.
//
// A repository's own skill (PRD 2313): a job carries the skills its repository's owner allowed, read when
// it was claimed, and its line is checked against them before anything is made. Once its worktree is cut
// from `origin/<default branch>`, the skill's `.claude/skills/<name>/SKILL.md` must be there, or the job
// fails `refused: /<name> is not on <default branch>` before Claude starts. Such a job has no outcome: it
// ends done or failed from its exit code alone.
//
// A job as a GitHub App (PRD 2433): a runner given `githubToken`, the command that prints a job's token,
// registers with `githubApp: true`. A job whose claim carries `github` starts as that app (`github-app.ts`):
// its identity, git over HTTPS and a `gh` first on its `PATH`, with the token in `~/logs/job-<id>.github`
// (`github-token.ts`) and in no variable. Every line, log tail and report the runner sends reads `***` for
// every token the job had, and the file goes once the job is reported. A job whose app cannot be set up ends
// `failed`, `github app: <why>`, before its session starts: it never runs as a person. A job with no `github`
// starts exactly as it always did.
//
// Its token lasts an hour (PRD 2433, s3): at every look at the running job the runner keeps it current
// (`github-refresh.ts`), asking the app for a fresh one with less than 5 minutes left and again every minute
// while that fails. A job whose token expires with no fresh one is stopped and ends `failed`,
// `github app: <why>`. Its claims are released with the job's token too, and with no token a job that ran as an
// app is released by no one: never as the machine's account.
//
// A job's parts (PRD 2537, s3): its process keeps one part per account it ran on in `~/logs/job-<id>.parts.json`
// (`turnover.ts`), and every report carries them. An app that refuses a report for them gets it again without,
// and no later report carries any. A job its turnover gave up on (no account left) fails with turnover's reason
// in place of its exit code. A job may turn over to any account of the file, so every account's secret is
// masked in what it sends.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecText } from '../context.ts';
import { parsePrd } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';
import { runnerJobVariables, runnerSenderVariables } from '../env/read.ts';
import { runningBundle } from '../init/bundle.ts';
import { RunnerRefused, RunnerUnreachable } from './api.ts';
import type { AccountReport, HealthLimits, HealthReport, JobUpdate, RunnerApi, RunnerJob } from './api.ts';
import { accountsReport, DEFAULT_LIMITS, machineReads, nextPause, noTokensPause, pressure, sample } from './health.ts';
import type { CpuTimes, MachineReads, PauseState } from './health.ts';
import type { MergedCount } from './follow.ts';
import { githubJobEnv, installGhShim } from './github-app.ts';
import { keepGithubToken } from './github-refresh.ts';
import type { RefreshOptions } from './github-refresh.ts';
import { accountBook, accountsStateFile, agentAccountOf, chooseAccount, FALLBACK_ACCOUNT, DEFAULT_HANDOFF, readSecret } from './accounts.ts';
import type { AccountBook, Accounts } from './accounts.ts';
import { agentNamed } from './agents/index.ts';
import { forgetGithubToken, githubTokenFile, jobTokens, maskTokens, readGithubToken, saveGithubToken } from './github-token.ts';
import { checkRunnerLine } from './line.ts';
import { tokenSource } from './tokens.ts';
import type { TokenSource } from './tokens.ts';
import { bugFixReading, fixIssueOf, fixOutcome, lastPullRequest, linesAfter, logTail, reportBatch, runOutcome } from './log.ts';
import type { BugFixReading, RunOutcome } from './log.ts';
import { pluginKeeper } from './plugin.ts';
import { partsPath, readParts } from './turnover.ts';
import type { PluginKeeper } from './plugin.ts';
import { notReleased } from './release.ts';
import type { Released, Releaser } from './release.ts';
import { dropJobBranch, pruneWorktrees, strandedJobs, sweep, sweptLine } from './sweep.ts';
import type { Terminal } from './terminal.ts';

/** Where the runner prints: `process.stdout`, or a test's buffer. */
export type Out = { write(text: string): unknown };

/** How long the runner waits between two looks at a running job. */
const TICK_MS = 5000;
/** The first wait after the app did not answer, doubled each time up to 60 s. */
const BACKOFF = { firstMs: 5000, maxMs: 60_000 };
/** How many times a job's last status is sent before the runner gives up on it. */
const FINAL_TRIES = 8;
/** How long the runner waits between two health samples (PRD 2102). */
const HEALTH_EVERY_MS = 15_000;
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
  /** The machine's reads the health samples are taken from: the real machine unless given. */
  machine?: MachineReads | undefined;
  /** The limits the runner pauses at: `DEFAULT_LIMITS` unless given. */
  limits?: HealthLimits | undefined;
  /** Where the token counts are read from: Claude's transcripts under the home, unless given. */
  tokens?: TokenSource | undefined;
  /** Releases the claims of a job that ended (PRD 2175): none are released unless given. */
  release?: Releaser | undefined;
  /**
   * The command that prints a job's GitHub App token (`omni runner github-token`), before its own flags (PRD 2433).
   * A runner given one registers as able to run a job as an app; without one a job that carries an app fails.
   */
  githubToken?: readonly string[] | undefined;
  /** The Omni page, kept in each app job's token file for `omni runner github-token` to ask a fresh token of (PRD 2433, s3). */
  askUrl?: string | undefined;
  /** The PRD's slices merged of all, read in the job's worktree when a job ended `stopped` (PRD 2375): never read unless given. */
  slices?: ((prd: PrdNumber, cwd: string) => Promise<MergedCount>) | undefined;
  /** The accounts file's accounts (PRD 2537): the one fallback account (no file) unless given. */
  accounts?: Accounts | undefined;
  /** The states of the accounts, kept across restarts: `accounts-state.json` under the home unless given. */
  accountBook?: AccountBook | undefined;
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
  limits: HealthLimits;
  /** Whether the machine is under pressure, and why: free slots open no `next` while it is. */
  pause: PauseState;
  /** The free slots waiting for the pause to end, woken on resume or once the runner halts. */
  waiting: Set<() => void>;
  /** The token counts' source. */
  counts: TokenSource;
  /** Whether job reports may carry tokens: once the health route answered 2xx, until an app refuses them. */
  tokensOk: boolean;
  /** Whether an app refused a report for its tokens: none is sent after. */
  tokensOff: boolean;
  /** Why every account is out (PRD 2537): `no tokens left until 18:00`, `null` while one is not. Free slots open no `next` while it holds. */
  noTokens: string | null;
  /** Whether an app refused a health report for its accounts: none is sent after. */
  accountsOff: boolean;
  /** Whether an app refused a report for a job's parts (PRD 2537): none is sent after. */
  partsOff: boolean;
  /** The runner's accounts and their states. */
  accounts: Accounts;
  book: AccountBook;
  /** The account each running job started on, and the secret values its run holds, masked in everything sent. */
  chosen: Map<string, string>;
  secrets: Map<string, string[]>;
};

/** A job's live lines: its log, and how many of its lines the app has accepted. */
type Live = { log: string; cursor: number };

/** `update` with the next lines of `live` after its cursor, when there are any. */
function withLines(update: JobUpdate, live: Live, lines: readonly string[]): JobUpdate {
  return lines.length === 0 ? update : { ...update, from: live.cursor + 1, lines: [...lines] };
}

/** Where a job runs and what it writes, and the repository's own skill it runs (`null` for a fixed skill). */
type Place = { checkout: string; worktree: string; session: string; line: string; log: string; exit: string; skill: string | null };

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };

const readText = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

/** A job's log as the runner sends it (PRD 2433): every GitHub token the job had, past ones too, reads `***`, before any line is cut or counted. */
const readLog = (loop: Loop, job: string, path: string): string => maskTokens(readText(path), maskedOf(loop, job));

/** Everything that must never leave this machine in what a job sends: its GitHub tokens and its account's secret. */
const maskedOf = (loop: Loop, job: string): string[] => [...jobTokens(loop.home, job), ...(loop.secrets.get(job) ?? [])];

/** The accounts and their book: the options', else the one fallback account and the book kept under the home. */
function accountsOf({ accounts, accountBook: book, home, now }: RunnerOptions): { accounts: Accounts; book: AccountBook } {
  return {
    accounts: accounts ?? { file: false, accounts: [FALLBACK_ACCOUNT], handoff: DEFAULT_HANDOFF },
    book: book ?? accountBook({ file: accountsStateFile(home), now }),
  };
}

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
    limits: options.limits ?? DEFAULT_LIMITS,
    pause: { reason: null, quiet: 0 },
    waiting: new Set(),
    noTokens: null,
    accountsOff: false,
    counts: options.tokens ?? tokenSource({ projects: join(options.home, '.claude', 'projects'), now: options.now ?? Date.now }),
    tokensOk: false,
    tokensOff: false,
    partsOff: false,
    ...accountsOf(options),
    chosen: new Map(),
    secrets: new Map(),
  };
}

/** Wakes every free slot waiting for the pause to end. */
function wake(loop: Loop): void {
  for (const resume of loop.waiting) resume();
  loop.waiting.clear();
}

/** Waits while the runner is paused: whether a free slot may open its `next`, `false` once the runner halts. */
async function unpaused(loop: Loop): Promise<boolean> {
  if ((loop.pause.reason !== null || loop.noTokens !== null) && !loop.halt.aborted) {
    await new Promise<void>((resolve) => {
      loop.waiting.add(resolve);
    });
  }
  return !loop.halt.aborted;
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
      return (await loop.api.register({ name: loop.name, slots: loop.slots, repos, version: loop.version ?? 'unknown', githubApp: loop.githubToken !== undefined })).id;
    } catch (error) {
      if (error instanceof RunnerRefused) loop.refuse(error);
      else if (error instanceof RunnerUnreachable) delay = await backOff(loop, delay, error, loop.halt);
      else throw error;
    }
  }
  return null;
}

/**
 * Sends a job's report. One that carries tokens and is refused is sent again without them, and no later
 * report carries any: an app older than PRD 2102 refuses a field it does not know. A refusal that
 * carries none, or a second one, is the app's answer as it stands.
 */
async function sendCounted(loop: Loop, job: string, update: JobUpdate): Promise<{ cancel: boolean }> {
  const { tokens, ...plain } = update;
  if (tokens === undefined) return loop.api.update(job, update);
  if (!loop.tokensOk) return loop.api.update(job, plain);
  try {
    return await loop.api.update(job, update);
  } catch (error) {
    if (!(error instanceof RunnerRefused)) throw error;
    loop.tokensOk = false;
    loop.tokensOff = true;
    return loop.api.update(job, plain);
  }
}

/** `update` with every GitHub token the job had, past ones too, replaced by `***` in each text it carries (PRD 2433, L-GDPR-2). */
function hideTokens(loop: Loop, job: string, update: JobUpdate): JobUpdate {
  const tokens = maskedOf(loop, job);
  if (tokens.length === 0) return update;
  const hide = (text: string): string => maskTokens(text, tokens);
  const hidden: JobUpdate = { ...update };
  for (const key of ['logTail', 'prUrl', 'reason', 'releaseError'] as const) {
    const text = update[key];
    if (typeof text === 'string') hidden[key] = hide(text);
  }
  if (update.lines !== undefined) hidden.lines = update.lines.map(hide);
  return hidden;
}

/**
 * Sends a job's report. One that carries what was released, an outcome, or a bug fix's pull requests or follow-ups, and
 * is refused is sent again without them: an app older than PRD 2175, 2223, 2375, 2425 or 2508 refuses a field it
 * does not know, or an outcome word it has no value for, and the job's status must still reach it.
 */
async function sendNewer(loop: Loop, job: string, update: JobUpdate): Promise<{ cancel: boolean }> {
  const { released, releaseError, outcome, slicesMerged, slicesTotal, fixedBy, prs, followUps, ...rest } = update;
  const newer = [released, releaseError, outcome, slicesMerged, slicesTotal, fixedBy, prs, followUps];
  if (newer.every((field) => field === undefined)) return sendCounted(loop, job, update);
  try {
    return await sendCounted(loop, job, update);
  } catch (error) {
    if (!(error instanceof RunnerRefused)) throw error;
    // An app from before PRD 2508 refuses `followUps` alone: the fields of PRD 2425 and the others are tried again first.
    if (followUps === undefined) return sendCounted(loop, job, rest);
    const withoutFollowUps: JobUpdate = { ...update };
    delete withoutFollowUps.followUps;
    try {
      return await sendCounted(loop, job, withoutFollowUps);
    } catch (again) {
      if (!(again instanceof RunnerRefused)) throw again;
      return sendCounted(loop, job, rest);
    }
  }
}

/**
 * Sends a job's report, every token and secret it had masked. One that carries the job's parts (PRD 2537) and is
 * refused is sent again without them, and no later report carries any: an app older than PRD 2537 refuses a field
 * it does not know, and the job's status must still reach it.
 */
async function sendUpdate(loop: Loop, job: string, raw: JobUpdate): Promise<{ cancel: boolean }> {
  const update = hideTokens(loop, job, raw);
  const { parts, ...unparted } = update;
  if (parts === undefined) return sendNewer(loop, job, update);
  if (loop.partsOff) return sendNewer(loop, job, unparted);
  try {
    return await sendNewer(loop, job, update);
  } catch (error) {
    if (!(error instanceof RunnerRefused)) throw error;
    loop.partsOff = true;
    return sendNewer(loop, job, unparted);
  }
}

/** The log of the job `job` on this machine. */
const logOf = (loop: Loop, job: string): string => join(loop.home, 'logs', `job-${job}.log`);

/** `update` with the job's parts as its process last wrote them (PRD 2537), unless an app refused them once. */
function withParts(loop: Loop, update: JobUpdate, job: string): JobUpdate {
  if (loop.partsOff) return update;
  const parts = readParts(partsPath(logOf(loop, job)))?.parts ?? [];
  return parts.length === 0 ? update : { ...update, parts };
}

/** `update` with the tokens of the worktree and every folder below it, when reports may carry them and they can be read. */
function withTokens(loop: Loop, update: JobUpdate, worktree: string): JobUpdate {
  if (!loop.tokensOk) return update;
  const tokens = loop.counts.job(worktree);
  return tokens === null ? update : { ...update, tokens };
}

/**
 * Sends a running job's status, with the lines after the cursor: a cancel waiting comes back true.
 * The cursor moves only once the app answers. The app not answering is no cancel.
 */
async function tick(loop: Loop, job: string, update: JobUpdate, live?: Live, log = ''): Promise<boolean> {
  const lines = live ? reportBatch(linesAfter(log, live.cursor, { ended: false })) : [];
  try {
    const { cancel } = await sendUpdate(loop, job, live ? withLines(update, live, lines) : update);
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
      await sendUpdate(loop, job, update);
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
  const log = readLog(loop, job, live.log);
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

/** The worktree a job runs in: `~/wt/<repo>-job-<id>`. */
function worktreeOf(loop: Loop, job: RunnerJob): string {
  return join(loop.home, 'wt', `${job.repo.split('/').at(-1) ?? job.repo}-job-${job.id}`);
}

/** Where `job` runs, or the status it ends on before it runs: a line refused (a repository's own skill
 * the job does not carry included, PRD 2313), a repository not held. */
function placeOf(loop: Loop, job: RunnerJob): Place | JobUpdate {
  const line = checkRunnerLine(job.line, job.allowedSkills);
  if (!line.ok) return { status: 'failed', reason: `refused: ${line.reason}` };
  const checkout = loop.checkouts.get(job.repo);
  if (checkout === undefined) return { status: 'failed', reason: `${job.repo} is not held by this runner` };
  const logs = join(loop.home, 'logs');
  return {
    checkout,
    worktree: worktreeOf(loop, job),
    session: `job-${job.id}`,
    line: join(logs, `job-${job.id}.line`),
    log: join(logs, `job-${job.id}.log`),
    exit: join(logs, `job-${job.id}.exit`),
    skill: line.kind === 'repository' ? line.skill : null,
  };
}

/** Fetches, then adds the job's worktree on its own branch from the default branch: the branch, or `null` when it failed. */
function makeWorktree(loop: Loop, job: RunnerJob, place: Place): string | null {
  try {
    loop.exec('git', ['-C', place.checkout, 'fetch', 'origin'], QUIET);
    const base = defaultBranch(loop.exec, place.checkout);
    mkdirSync(join(loop.home, 'wt'), { recursive: true });
    loop.exec('git', ['-C', place.checkout, 'worktree', 'add', '--no-track', '-b', `agent/job-${job.id}`, place.worktree, `origin/${base}`], QUIET);
    return base;
  } catch {
    return null;
  }
}

/** The status a job of a repository's own skill ends on when the worktree, cut from `base`, lacks the
 * skill's `SKILL.md` (PRD 2313): a skill only on a branch never runs. `null` when it may run. */
function skillMissing(place: Place, base: string): JobUpdate | null {
  if (place.skill === null || existsSync(join(place.worktree, '.claude', 'skills', place.skill, 'SKILL.md'))) return null;
  return { status: 'failed', reason: `refused: /${place.skill} is not on ${base}` };
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

/**
 * What a job runs as (PRD 2433): the variables of its app, its token kept for the session to read, or why it
 * cannot run as the app, in the words its report carries. A job with no app runs as the runner always ran it:
 * no variable more, and no token kept. The token goes in a file and nowhere else.
 */
function asApp(loop: Loop, job: RunnerJob): { env: Record<string, string> } | { failed: string } {
  if (job.github === null) return { env: {} };
  const file = githubTokenFile(loop.home, job.id);
  if (loop.githubToken === undefined || file === null) return { failed: 'github app: this runner cannot give the job its token' };
  try {
    saveGithubToken(file, loop.name, job.github, loop.askUrl);
    const shimDir = installGhShim({ home: loop.home, tokenCommand: loop.githubToken, path: loop.env.PATH });
    return { env: githubJobEnv({ bot: job.github, tokenCommand: loop.githubToken, shimDir, path: loop.env.PATH }) };
  } catch (error) {
    // The detail names a folder of this machine: it stays here, and the report carries the reason alone.
    loop.print(`job ${job.id}: its GitHub App token could not be kept (${error instanceof Error ? error.message : String(error)})`);
    return { failed: 'github app: the token could not be kept on this machine' };
  }
}

/** Writes the job's line and its log, empty or starting on `note`, then starts its session as `app`: whether it started. */
function startSession(loop: Loop, job: RunnerJob, place: Place, note: string | null, app: Record<string, string>): boolean {
  const account = loop.chosen.get(job.id);
  mkdirSync(join(loop.home, 'logs'), { recursive: true });
  writeFileSync(place.line, `${job.line}\n`);
  writeFileSync(place.log, note === null ? '' : `${note}\n`);
  rmSync(place.exit, { force: true });
  try {
    loop.terminal.start({
      name: place.session,
      cwd: place.worktree,
      env: { ...loop.env, ...runnerJobVariables(job.id, loop.name), ...runnerSenderVariables(job, loop.name), ...WAIT_FOR_AGENTS, ...app },
      argv: [...loop.wrapper, '--line', place.line, '--log', place.log, '--exit', place.exit, ...(account === undefined ? [] : ['--account', account])],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * What a `/omni:yolo` or `/omni:yolo-fix` job's hand-off ended on (PRD 2223), `stopped` with none (PRD 2375);
 * `stopped` for a `/omni:mega-bug-fix` job of an issue whose hand-off ends on the line that resumes it; `null`
 * for any other job.
 */
function outcomeOf(log: string, line: string): RunOutcome | null {
  const checked = checkRunnerLine(line);
  if (!checked.ok) return null;
  const args = checked.args.trim();
  if (checked.skill === 'mega-bug-fix') {
    const issue = fixIssueOf(args);
    return issue === null ? null : fixOutcome(log, issue);
  }
  return (checked.skill === 'yolo' || checked.skill === 'yolo-fix') && /^[1-9]\d*$/.test(args) ? runOutcome(log, parsePrd(args), checked.skill) : null;
}

/** `update` with the PRD's slice count when a yolo job stopped mid-way (PRD 2375); as it is when the count cannot be read, which stops nothing. */
async function withSlices(loop: Loop, job: RunnerJob, place: Place, update: JobUpdate): Promise<JobUpdate> {
  if (update.outcome !== 'stopped' || loop.slices === undefined) return update;
  const checked = checkRunnerLine(job.line);
  if (!checked.ok || (checked.skill !== 'yolo' && checked.skill !== 'yolo-fix')) return update;
  try {
    const count = await loop.slices(parsePrd(checked.args.trim()), place.worktree);
    return count === null ? update : { ...update, slicesMerged: count.merged, slicesTotal: count.total };
  } catch {
    return update;
  }
}

/** What a `/omni:bug-fix` or `/omni:mega-bug-fix` job's log says of its end (PRD 2425); `null` for any other job. */
function bugFixOf(log: string, line: string): BugFixReading | null {
  const checked = checkRunnerLine(line);
  return checked.ok && (checked.skill === 'bug-fix' || checked.skill === 'mega-bug-fix') ? bugFixReading(log) : null;
}

/** The fields a done bug fix's log adds to its report (PRD 2425): what the log does not say is left out. */
function bugFixFields({ outcome, fixedBy, prs, followUps }: BugFixReading): Pick<JobUpdate, 'outcome' | 'fixedBy' | 'prs' | 'followUps'> {
  return { ...(outcome === null ? {} : { outcome }), ...(fixedBy === null ? {} : { fixedBy }), ...(prs.length === 0 ? {} : { prs }), ...(followUps.length === 0 ? {} : { followUps }) };
}

/**
 * `failed`, the status of a bug fix that did not end done, with the pull requests its log names, the
 * draft it left included, and no outcome (PRD 2425); as it is for any other job, or a log naming none.
 */
function failedWithPrs(failed: JobUpdate, log: string, line: string): JobUpdate {
  const reading = bugFixOf(log, line);
  return reading === null || reading.prs.length === 0 ? failed : { ...failed, prs: reading.prs };
}

/**
 * The status a run that ended with `exitText` reports: done with its pull request, or failed with its code, or with
 * the reason its turnover ended it on (`turnedOver`, PRD 2537: no account left to take it over).
 */
function ended(log: string, exitText: string, job: RunnerJob, turnedOver: string | null): JobUpdate {
  const code = Number.parseInt(exitText, 10);
  const exitCode = Number.isNaN(code) ? 1 : code;
  if (exitCode === 0) {
    const done: JobUpdate = { status: 'done', logTail: logTail(log), prUrl: lastPullRequest(log, job.repo), exitCode: 0 };
    const bugFix = bugFixOf(log, job.line);
    const outcome = outcomeOf(log, job.line);
    // A mega bug fix whose hand-off ends on the line that resumes it reads `stopped` (#2449), whatever its Outcome word.
    return { ...done, ...(bugFix === null ? {} : bugFixFields(bugFix)), ...(outcome === null ? {} : { outcome }) };
  }
  return failedWithPrs({ status: 'failed', logTail: logTail(log), exitCode, reason: turnedOver ?? `exit code ${String(exitCode)}` }, log, job.line);
}

/** The status a run whose session ended before it wrote its exit code reports: done on its hand-off's
 * outcome when it printed one (#2388), since what it waits for is a person, else failed, never
 * `stopped`, which is for a run that exited 0 (PRD 2375). */
function vanished(log: string, job: RunnerJob): JobUpdate {
  const reason = 'the job stopped before it wrote its exit code';
  const outcome = outcomeOf(log, job.line);
  if (outcome === null || outcome === 'stopped') return failedWithPrs({ status: 'failed', logTail: logTail(log), reason }, log, job.line);
  return { status: 'done', logTail: logTail(log), prUrl: lastPullRequest(log, job.repo), exitCode: null, reason, outcome };
}

/** The reason the job's turnover ended it on (PRD 2537): no account left to take it over; `null` when it did not. */
const turnedOver = (place: Place): string | null => readParts(partsPath(place.log))?.reason ?? null;

/** Stops the job's session and answers `update`. */
function killed(loop: Loop, job: string, place: Place, update: JobUpdate): JobUpdate {
  loop.terminal.stop(place.session);
  return { ...update, logTail: logTail(readLog(loop, job, place.log)) };
}

/** What keeps a token current for `job` in `file`: the app's refresh route, the runner's clock and sleep (PRD 2433, s3). */
const refreshOf = (loop: Loop, job: string, file: string): RefreshOptions => ({
  file,
  runner: loop.name,
  job,
  fetchToken: (id) => loop.api.githubToken(id),
  now: loop.now,
  sleep: (ms) => loop.sleep(ms),
});

/**
 * Keeps the token of a running job that runs as an app current (PRD 2433, s3): `null` while it has one, and
 * the reason the job ends on once it has none, `github app: <why>`. A job with no app has nothing to keep.
 */
async function appLacking(loop: Loop, job: RunnerJob): Promise<string | null> {
  const file = job.github === null ? null : githubTokenFile(loop.home, job.id);
  if (file === null) return null;
  const kept = await keepGithubToken(refreshOf(loop, job.id, file));
  return kept.token === null ? `github app: ${kept.failed}` : null;
}

/** Looks at the running job every tick, until it ends, is cancelled or runs past the timeout. */
async function watch(loop: Loop, job: RunnerJob, place: Place, live: Live): Promise<JobUpdate> {
  const started = loop.now();
  if (await tick(loop, job.id, { status: 'running', logTail: '' })) return killed(loop, job.id, place, { status: 'cancelled' });
  for (;;) {
    await loop.sleep(loop.tickMs);
    const log = readLog(loop, job.id, place.log);
    if (existsSync(place.exit)) return withSlices(loop, job, place, ended(log, readText(place.exit), job, turnedOver(place)));
    if (!loop.terminal.alive(place.session)) return vanished(readLog(loop, job.id, place.log), job);
    if (loop.now() - started > loop.timeoutMs) return killed(loop, job.id, place, failedWithPrs({ status: 'failed', reason: 'timeout' }, log, job.line));
    const noApp = await appLacking(loop, job);
    if (noApp !== null) return killed(loop, job.id, place, { status: 'failed', reason: noApp });
    if (await tick(loop, job.id, withParts(loop, withTokens(loop, { status: 'running', logTail: logTail(log) }, place.worktree), job.id), live, log)) return killed(loop, job.id, place, { status: 'cancelled' });
  }
}

/**
 * Picks the account `job` starts on (PRD 2537): the first, in the file's order, that is not out, whose `takes`
 * allows the job's skill and whose agent passed its check. `null` once it holds one, else the reason the job
 * ends on. A runner with no accounts file has its one Claude account and checks nothing here, as before.
 */
function takeAccount(loop: Loop, job: RunnerJob): string | null {
  if (!loop.accounts.file) return null;
  const line = checkRunnerLine(job.line, job.allowedSkills);
  const skill = line.ok && line.kind === 'omni' ? line.skill : null;
  const projects = join(loop.home, '.claude', 'projects');
  const chosen = chooseAccount({
    accounts: loop.accounts.accounts,
    book: loop.book,
    skill,
    unusable: (account) => {
      const agent = agentNamed(account.agent, { projects, exec: loop.exec });
      return agent === null ? `the ${account.agent} agent is not available in this kit` : agent.check(agentAccountOf(account, loop.home));
    },
  });
  if ('none' in chosen) return chosen.none;
  const { account } = chosen;
  loop.book.activate(account.id);
  loop.chosen.set(job.id, account.id);
  // The job may turn over to any account of the file (PRD 2537, s3): every one's secret is masked in what it sends.
  const secrets = loop.accounts.accounts.flatMap((each) => (each.secret === null ? [] : [readSecret(each.secret, loop.home)])).filter((secret) => secret !== '');
  if (secrets.length > 0) loop.secrets.set(job.id, secrets);
  loop.print(`job ${job.id} runs on account ${account.id}`);
  return null;
}

/** The account a job ran on is free again, and its secret forgotten. */
function freeAccount(loop: Loop, job: string): void {
  const id = loop.chosen.get(job);
  if (id !== undefined) loop.book.release(id);
  loop.chosen.delete(job);
  loop.secrets.delete(job);
}

/** Runs `job` to its end, and answers its last status and its live lines, once it has a log. */
async function runJob(loop: Loop, job: RunnerJob): Promise<{ last: JobUpdate; live: Live | null }> {
  const place = placeOf(loop, job);
  if ('status' in place) return { last: place, live: null };
  const base = makeWorktree(loop, job, place);
  if (base === null) return { last: { status: 'failed', reason: 'the worktree could not be made' }, live: null };
  try {
    const missing = skillMissing(place, base);
    if (missing !== null) return { last: missing, live: null };
    const plugin = await loop.plugin.forJob(place.worktree, job.repo);
    if ('failed' in plugin) return { last: { status: 'failed', reason: plugin.failed }, live: null };
    const app = asApp(loop, job);
    if ('failed' in app) return { last: { status: 'failed', reason: app.failed }, live: null };
    const taken = takeAccount(loop, job);
    if (taken !== null) return { last: { status: 'failed', reason: taken }, live: null };
    if (!startSession(loop, job, place, plugin.note, app.env)) return { last: { status: 'failed', reason: 'the tmux session could not be started' }, live: null };
    const live: Live = { log: place.log, cursor: 0 };
    return { last: await watch(loop, job, place, live), live };
  } finally {
    cleanUp(loop, job, place);
  }
}

/** Removes the file a job's GitHub App token was kept in, when it has one. */
function forgetJobToken(loop: Loop, job: string): void {
  const file = githubTokenFile(loop.home, job);
  if (file !== null) forgetGithubToken(file);
}

/** The line a job's end prints. */
function endLine(job: RunnerJob, last: JobUpdate): string {
  const detail = last.status === 'done' ? last.prUrl : last.reason;
  return `job ${job.id} ${last.status}${detail ? ` · ${detail}` : ''}`;
}

/** Why a job ended, as its released claims' alarm says it: a failure's reason, else its status. */
function endReason(last: JobUpdate): string {
  return last.status === 'failed' ? last.reason ?? 'failed' : last.status;
}

/** The lines a release prints: the claims released, and what failed; none when it did nothing. */
function releaseLines(job: string, { released, releaseError }: Released): string[] {
  return [
    ...(released.length === 0 ? [] : [`job ${job} released ${released.map((n) => `#${String(n)}`).join(', ')}`]),
    ...(releaseError === null ? [] : [`job ${job} could not release its claims: ${releaseError}`]),
  ];
}

/**
 * Releases the claims of an ended job, `ran` saying whether it ran as an app (PRD 2433, s3): with the job's
 * token, kept current (the app answers its refresh route for 10 minutes after the end), so the label and the
 * comment are the app's. A job that ran as an app and has no token now releases nothing, and says why: its
 * claims are never released as the machine's account. A job that ran as the machine is released as it always was.
 */
async function releasedAs(loop: Loop, release: Releaser, ended: { id: string; repo: string; reason: string }, ran: boolean): Promise<Released> {
  const file = ran ? githubTokenFile(loop.home, ended.id) : null;
  let ghToken: string | null = null;
  let lacking: Released | null = null;
  if (ran) {
    const kept = file === null ? null : await keepGithubToken(refreshOf(loop, ended.id, file));
    if (kept === null || kept.token === null) lacking = notReleased(`github app: ${kept === null ? 'the job has no token kept on this machine' : kept.failed}`);
    else ghToken = kept.token.token;
  }
  const done = lacking ?? release({ id: ended.id, runner: loop.name, repo: ended.repo, reason: ended.reason, ghToken });
  const hide = (text: string): string => (ghToken === null ? text : maskTokens(text, jobTokens(loop.home, ended.id)));
  for (const line of releaseLines(ended.id, done)) loop.print(hide(line));
  return done;
}

/** Releases the claims of `job`, which ended on `last`: `last` with what was released, or as it is when the runner releases nothing. */
async function releasing(loop: Loop, job: RunnerJob, last: JobUpdate): Promise<JobUpdate> {
  if (loop.release === undefined) return last;
  const done = await releasedAs(loop, loop.release, { id: job.id, repo: job.repo, reason: endReason(last) }, job.github !== null);
  return { ...last, released: done.released, releaseError: done.releaseError };
}

/** Whether the job left a token file: it ran as an app, whoever's the file is. */
function ranAsApp(loop: Loop, job: string): boolean {
  const file = githubTokenFile(loop.home, job);
  return file !== null && readGithubToken(file) !== null;
}

/**
 * Releases the claims of a job the app marked lost, `runner lost`, and reports what it released when
 * there is something to say. The job has ended on the app: a report it refuses, or never answers,
 * prints one line and stops nothing. `ran` says whether it ran as an app, read before the sweep, which takes
 * an old token file with the rest: it is released as that app, or not at all.
 */
async function releaseLost(loop: Loop, lost: { job: string; repo: string; ran: boolean }): Promise<void> {
  if (loop.release === undefined) return;
  const { ran } = lost;
  try {
    const done = await releasedAs(loop, loop.release, { id: lost.job, repo: lost.repo, reason: 'runner lost' }, ran);
    if (done.released.length === 0 && done.releaseError === null) return;
    try {
      await loop.api.update(lost.job, hideTokens(loop, lost.job, { status: 'failed', released: done.released, releaseError: done.releaseError }));
    } catch (error) {
      loop.print(`job ${lost.job}: its release was not reported (${error instanceof Error ? error.message : String(error)})`);
    }
  } finally {
    // Once its release is reported: the token of a job that is gone is kept no longer.
    if (ran) forgetJobToken(loop, lost.job);
  }
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
    if (!(await unpaused(loop))) return;
    const job = await nextJob(loop, runner, wait);
    if (job === 'stop') return;
    if (job === null) continue;
    loop.running += 1;
    loop.jobs.add(job.id);
    loop.print(`job ${job.id} claimed: ${job.line} (${job.repo})`);
    try {
      const { last, live } = await runJob(loop, job);
      // A job whose session never started made no claim: it has nothing to release.
      const report = live === null ? last : await releasing(loop, job, last);
      await finish(loop, job.id, withParts(loop, withTokens(loop, report, worktreeOf(loop, job)), job.id), live);
      loop.print(endLine(job, last));
    } finally {
      // Once its last report is sent: the log is masked with the file until then.
      forgetJobToken(loop, job.id);
      freeAccount(loop, job.id);
      loop.jobs.delete(job.id);
      loop.running -= 1;
    }
  }
}

/** Pauses or resumes the runner on `reason`, printing the change once and waking the free slots on resume. */
function decide(loop: Loop, reason: string | null): void {
  const { state, change } = nextPause(loop.pause, reason);
  loop.pause = state;
  if (change === 'paused') loop.print(`paused: ${String(state.reason)}`);
  if (change === 'resumed') {
    loop.print('resumed');
    wake(loop);
  }
}

/** Pauses the runner while every account is out and takes jobs again once one is ready (PRD 2537), printing the change once. A runner with no accounts file never pauses so. */
function decideTokens(loop: Loop): AccountReport[] | null {
  if (!loop.accounts.file) return null;
  const accounts = accountsReport(loop.accounts.accounts, loop.book);
  const reason = noTokensPause(accounts);
  if (reason !== null && loop.noTokens === null) loop.print(`paused: ${reason}`);
  const resumed = reason === null && loop.noTokens !== null;
  loop.noTokens = reason;
  if (resumed) {
    loop.print('resumed');
    wake(loop);
  }
  return accounts;
}

/** Sends one health report; one an app refuses for its accounts is sent again without them, and none carries them after. */
async function sendHealth(loop: Loop, runner: string, report: HealthReport): Promise<void> {
  const { accounts, ...plain } = report;
  if (accounts === undefined || loop.accountsOff) return loop.api.health(runner, plain);
  try {
    await loop.api.health(runner, report);
  } catch (error) {
    if (!(error instanceof RunnerRefused)) throw error;
    loop.accountsOff = true;
    await loop.api.health(runner, plain);
  }
}

/**
 * Samples the machine, pauses or resumes on it, and sends its health, now and then every 15 s, until
 * the runner stops or is refused. A report the app refuses or does not answer prints one line; the
 * runner carries on. The first sample is decided before the first `await`, and so before any slot
 * opens its `next`: a machine already under pressure takes no job.
 */
async function reporter(loop: Loop, runner: string): Promise<void> {
  const reads = loop.machine ?? machineReads(loop.home);
  let times: CpuTimes | null = null;
  const halted = (): void => {
    wake(loop);
  };
  loop.halt.addEventListener('abort', halted, { once: true });
  while (!loop.halt.aborted) {
    const started = loop.now();
    const taken = sample(reads, times);
    times = taken.times;
    decide(loop, pressure(taken.sample, loop.limits));
    const accounts = decideTokens(loop);
    try {
      const tokens = loop.counts.machine();
      await sendHealth(loop, runner, { ...taken.sample, paused: loop.pause.reason ?? loop.noTokens, limits: loop.limits, ...(tokens === null ? {} : { tokens }), ...(accounts === null ? {} : { accounts }) });
      loop.tokensOk = !loop.tokensOff;
    } catch (error) {
      loop.print(`health not sent: ${error instanceof Error ? error.message : String(error)}`);
    }
    await loop.sleep(Math.max(0, HEALTH_EVERY_MS - (loop.now() - started)), loop.halt);
  }
}

/**
 * Sweeps now and updates the Omni plugin, then every hour, until the runner stops or is refused. The
 * jobs whose worktree it removes, which no slot holds, were lost: their claims are released.
 */
async function sweeper(loop: Loop): Promise<void> {
  const keepLogsDays = loop.keepLogsDays ?? KEEP_LOGS_DAYS;
  while (!loop.halt.aborted) {
    // Whether each ran as an app is read first: the sweep removes a token file older than `keepLogsDays`.
    const lost = strandedJobs({ home: loop.home, checkouts: loop.checkouts, running: loop.jobs }).map((stranded) => ({ ...stranded, ran: ranAsApp(loop, stranded.job) }));
    const line = sweptLine(sweep({ home: loop.home, checkouts: loop.checkouts, exec: loop.exec, running: loop.jobs, keepLogsDays, now: loop.now() }));
    if (line !== null) loop.print(line);
    for (const job of lost) await releaseLost(loop, job);
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
    // The reporter starts before the slots, so its first sample pauses the runner before any `next`.
    await Promise.all([sweeper(loop), reporter(loop, runner), ...Array.from({ length: loop.slots }, () => slot(loop, runner))]).finally(() => {
      options.stop.removeEventListener('abort', onStop);
    });
  }
  const refused = loop.refused();
  loop.print(refused ?? `runner ${loop.name} stopped`);
  return refused === null ? 0 : 1;
}
