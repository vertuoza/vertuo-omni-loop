// `omni runner` (PRD 1830): makes this machine a runner of the Omni app, which runs the `/omni:` lines
// people send it from the app with Send to terminal.
//
//   omni runner --name <name> --repos <dir> [--slots 4] [--timeout 3h] [--keep-logs 14]
//               [--max-memory 85] [--min-disk 10] [--max-load 1.5]
//   omni runner sender
//   omni runner github-token [--git get]
//   omni runner send '<line>' [--to <runner|fleet>]
//   omni runner follow <n>
//   omni runner job --line <file> --log <file> --exit <file>
//   omni runner ask --file <file> --issue <n> --lead <file>
//   omni runner answers <job>
//
// The first starts the runner (`../../lib/runner/runner.ts`): it reads the sign-in every kit command
// reads (`OMNI_TOKEN`, else `omni signin`'s), lists the git checkouts under `--repos` by their
// `origin`, refuses to register when `claude` is missing or signed out or tmux is missing, then
// registers and keeps one `next` open per free slot until Ctrl-C, which waits for the running jobs.
// It sweeps what stopped jobs left once registered and every hour after (PRD 1911): a job's logs are
// kept `--keep-logs` days, a whole number of 1 or more, 14 unless given.
// Each job's session gets `OMNI_JOB`, `OMNI_RUNNER` and `OMNI_UNATTENDED` (PRD 2175). Once a job ends,
// or the sweep finds one the app marked lost, it releases the claims the job still holds with `gh`
// (`../../lib/runner/release.ts`): `labels.inProgress` off, `labels.released` on, and a comment.
// It stops taking jobs while its machine is under pressure (PRD 2102): memory used above `--max-memory`
// percent (1 to 100, 85 unless given), disk free below `--min-disk` GB (0 or more, 10 unless given), or
// a 1-minute load above `--max-load` times its cores (above 0, 1.5 unless given). A limit out of range
// is refused in plain words before the runner registers.
// The Omni page is the `ask.url` of the config where it runs, else of the first checkout held that
// sets one.
//
// `sender` prints the line `/omni:pr` writes in a pull request a job opens, `Sent from the Omni app by
// @<login> on runner <name>`, read from `OMNI_SENT_BY` and `OMNI_RUNNER`; a job an API key sent names the
// key instead, `Sent through the Omni API by API key <name> on runner <name>`, read from `OMNI_SENT_BY_KEY`
// (PRD 2433); either unset, it prints nothing. `job` is what runs inside a job's tmux session
// (`../../lib/runner/job.ts`): no person runs it.
//
// `github-token` prints the current token of the GitHub App a job runs as (PRD 2433), read from the file its
// runner keeps for the job (`../../lib/runner/github-token.ts`), and refuses with one line on stderr, exit 1,
// outside a runner job, in a job of another runner or in a job with no app. With `--git get` it answers git's
// credential helper call instead (`username=x-access-token`, `password=<token>`) and does nothing for `store`
// or `erase`. The runner starts such a job with this command as its credential helper and as the token the
// `gh` on the job's `PATH` reads; a runner that has it registers as able to run an app's job.
//
// `send` queues a line for this repository's workspace and `follow` prints a PRD's job milestones
// until it ends (PRD 2251, `./runner-follow.ts`); both use the terminal's own sign-in.
//
// `ask` and `answers` run inside a job's session too (PRD 2255): `/omni:bug-fix` and `/omni:mega-bug-fix`, at
// their stop for a decision, ask the person on the job. `ask` reads `OMNI_JOB`, checks `--file` (`omni ask`'s
// question file, 1 to 4 questions of 2 to 4 options each) and `--lead` (one paragraph, why the skill stopped),
// posts them with `--issue` to the job's questions route with the job's sign-in, and prints the line the
// stop comment ends on, `Waiting for an answer on Omni: <the Runners page, on the job's drawer>`. It exits 0
// once they are stored, and 1 with one line, the app's own words, otherwise (a skill then posts its stop
// as it always did). `answers <job>` prints that job's row as the app holds it, questions and answers, as
// one line of JSON, and exits 1 with one line when it cannot be read: the resumed run reads it from there.
//
// A test hands it `tokens`, `home`, `fetch`, `terminal`, `stop`, `sleep`, `now`, `tickMs`, `backoff` and
// `machine`, the reads its health samples are taken from.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { loadContext } from '../../lib/context.ts';
import { runnerJobOf } from '../../lib/env/read.ts';
import type { IssueNumber } from '../../lib/ids.ts';
import { runningKit } from '../../lib/init/bundle.ts';
import { jobQuestionsApi, RunnerRefused, RunnerUnreachable, runnerApi } from '../../lib/runner/api.ts';
import type { HealthLimits, JobQuestionsApi } from '../../lib/runner/api.ts';
import { listCheckouts } from '../../lib/runner/checkouts.ts';
import { jobGithubToken } from '../../lib/runner/github-token.ts';
import { DEFAULT_LIMITS } from '../../lib/runner/health.ts';
import type { MachineReads } from '../../lib/runner/health.ts';
import { runJobProcess } from '../../lib/runner/job.ts';
import { parseDuration } from '../../lib/runner/log.ts';
import { readJobQuestions, waitingLine } from '../../lib/runner/questions.ts';
import type { JobQuestionList } from '../../lib/runner/questions.ts';
import { releaser } from '../../lib/runner/release.ts';
import { KEEP_LOGS_DAYS, runRunner } from '../../lib/runner/runner.ts';
import { senderLine } from '../../lib/runner/sender.ts';
import { missingTool, tmuxTerminal } from '../../lib/runner/terminal.ts';
import type { Terminal } from '../../lib/runner/terminal.ts';
import { issueArg, parseArgs, positiveInt, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo, Out } from '../io.ts';
import { boardCount, followCommand, interrupts, send } from './runner-follow.ts';
import type { FollowOptions } from './runner-follow.ts';

const USAGE = "usage: omni runner --name <name> --repos <dir> [--slots 4] [--timeout 3h] [--keep-logs 14] [--max-memory 85] [--min-disk 10] [--max-load 1.5] | omni runner sender | omni runner github-token [--git get] | omni runner send '<line>' [--to <runner|fleet>] | omni runner follow <n> | omni runner ask --file <file> --issue <n> --lead <file> | omni runner answers <job>";
const ASK_USAGE = 'usage: omni runner ask --file <file> --issue <n> --lead <file>';
const ANSWERS_USAGE = 'usage: omni runner answers <job>';
const GITHUB_TOKEN_USAGE = 'usage: omni runner github-token [--git get]';
const DEFAULT_SLOTS = 4;
const MAX_SLOTS = 8;
const DEFAULT_TIMEOUT = '3h';
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

/** What a test hands `omni runner` beyond `main()`'s own. */
type RunnerCommandOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  terminal?: Terminal;
  stop?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  tickMs?: number;
  backoff?: { firstMs: number; maxMs: number };
  machine?: MachineReads;
} & FollowOptions;

/** The `ask.url` of `dir`'s config, or `null` when it has none or no config. */
function askUrlOf(dir: string, exec: Exec): string | null {
  try {
    return loadContext(dir, { exec }).config.ask.url;
  } catch {
    return null;
  }
}

/** The Omni page: `ask.url` where the runner runs, else of the first checkout held that sets one. */
function findAskUrl(cwd: string, checkouts: ReadonlyMap<string, string>, exec: Exec): string | null {
  for (const dir of [cwd, ...checkouts.values()]) {
    const url = askUrlOf(dir, exec);
    if (url !== null) return url;
  }
  return null;
}

/** `--keep-logs`: a whole number of days, 1 or more, `KEEP_LOGS_DAYS` unless given. */
function keepLogsOf(value: string | true | undefined): number {
  return value === undefined ? KEEP_LOGS_DAYS : positiveInt('runner', '--keep-logs', value);
}

/** A number written in plain digits, a decimal point allowed: "1e2", "0x10" or "-1" are not. */
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

/** One limit flag: `fallback` unless given, else its number when `fits`, else refused in `words`. */
function limitOf(flag: string, value: string | true | undefined, fallback: number, fits: (limit: number) => boolean, words: string): number {
  if (value === undefined) return fallback;
  const limit = typeof value === 'string' && PLAIN_NUMBER.test(value) ? Number(value) : Number.NaN;
  if (!fits(limit)) throw usageError(`omni runner: ${flag} is ${words}, got "${String(value)}".`);
  return limit;
}

/** `--max-memory`, `--min-disk` and `--max-load`: the limits the runner pauses at, `DEFAULT_LIMITS` for those not given. */
function limitsOf(flags: Partial<Record<'max-memory' | 'min-disk' | 'max-load', string | true>>): HealthLimits {
  return {
    maxMemory: limitOf('--max-memory', flags['max-memory'], DEFAULT_LIMITS.maxMemory, (limit) => limit >= 1 && limit <= 100, 'the share of memory used, in percent, the runner pauses above: a number from 1 to 100'),
    minDiskGb: limitOf('--min-disk', flags['min-disk'], DEFAULT_LIMITS.minDiskGb, (limit) => limit >= 0, 'the free disk, in GB, the runner pauses below: a number of 0 or more'),
    maxLoad: limitOf('--max-load', flags['max-load'], DEFAULT_LIMITS.maxLoad, (limit) => limit > 0, 'the 1-minute load, in times the cores, the runner pauses above: a number above 0'),
  };
}

/** The runner's flags, checked. */
function readFlags(args: string[], cwd: string): { name: string; slots: number; timeoutMs: number; repos: string; keepLogsDays: number; limits: HealthLimits } {
  const { positional, flags } = parseArgs('runner', args, { values: ['name', 'repos', 'slots', 'timeout', 'keep-logs', 'max-memory', 'min-disk', 'max-load'] });
  const { name, repos } = flags;
  if (positional.length || name === undefined || repos === undefined) throw usageError(USAGE);
  if (!NAME.test(name)) throw usageError('omni runner: --name must be 1 to 40 letters, digits, dots, dashes or underscores.');
  const slots = flags.slots === undefined ? DEFAULT_SLOTS : positiveInt('runner', '--slots', flags.slots);
  if (slots > MAX_SLOTS) throw usageError(`omni runner: --slots must be ${String(MAX_SLOTS)} at most, got "${String(slots)}".`);
  const timeout = flags.timeout ?? DEFAULT_TIMEOUT;
  const timeoutMs = parseDuration(timeout);
  if (timeoutMs === null) throw usageError(`omni runner: --timeout must read like 90s, 45m or 3h, got "${timeout}".`);
  return { name, slots, timeoutMs, repos: resolve(cwd, repos), keepLogsDays: keepLogsOf(flags['keep-logs']), limits: limitsOf(flags) };
}

/**
 * The variables every job's session gets: the runner's `PATH`, and its kit token and its Claude token
 * (PRD 1894) when it has them. A tmux session takes the rest from the tmux server, not the runner.
 */
function jobEnv({ env, vars }: FreeIo): Record<string, string> {
  return {
    ...(env.PATH ? { PATH: env.PATH } : {}),
    ...(vars.omniToken ? { OMNI_TOKEN: vars.omniToken.token } : {}),
    ...(vars.claudeToken === null ? {} : { CLAUDE_CODE_OAUTH_TOKEN: vars.claudeToken }),
  };
}

/** The test's own clock, sleep, tick, back-off and machine, when it hands them. */
const timing = ({ sleep, now, tickMs, backoff, machine }: RunnerCommandOptions) => ({ sleep, now, tickMs, backoff, machine });

/** The Omni page, or the one line saying why the runner cannot start. */
function pageOrRefusal(cwd: string, repos: string, checkouts: ReadonlyMap<string, string>, exec: Exec): { askUrl: string } | { refusal: string } {
  const askUrl = findAskUrl(cwd, checkouts, exec);
  if (askUrl === null) return { refusal: `no Omni page is set (ask.url) here or in any checkout under ${repos}` };
  const missing = missingTool(exec);
  return missing === null ? { askUrl } : { refusal: missing };
}

/** The sign-in a call carries: a test's own, else the kit token `OMNI_TOKEN`, else the one `omni signin` keeps. */
const tokensOf = (io: FreeIo & RunnerCommandOptions): TokenStore => io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null });

/** The sign-in, the terminal, the home and the stop signal: a test's own, else the real ones. */
function wiring(io: FreeIo & RunnerCommandOptions) {
  const tokens = tokensOf(io);
  const stop = io.stop ? { signal: io.stop, release: () => undefined } : interrupts();
  return { tokens, stop, terminal: io.terminal ?? tmuxTerminal(io.exec), home: io.home ?? homedir(), fetch: io.fetch ?? globalThis.fetch };
}

async function start(args: string[], io: FreeIo & RunnerCommandOptions): Promise<number> {
  const { cwd, stdout, stderr, exec, script } = io;
  const { name, slots, timeoutMs, repos, keepLogsDays, limits } = readFlags(args, cwd);
  const checkouts = listCheckouts(repos, exec);
  const page = pageOrRefusal(cwd, repos, checkouts, exec);
  if ('refusal' in page) {
    println(stderr, `omni runner: ${page.refusal}`);
    return 1;
  }
  if (!script) throw new Error('omni runner: the omni script that runs a job is unknown');
  const { tokens, stop, terminal, home, fetch } = wiring(io);
  try {
    return await runRunner({
      name,
      slots,
      timeoutMs,
      version: runningKit({ exec }).version,
      checkouts,
      api: runnerApi({ askUrl: page.askUrl, tokens, fetch }),
      terminal,
      exec,
      home,
      wrapper: [process.execPath, script, 'runner', 'job'],
      githubToken: [process.execPath, script, 'runner', 'github-token'],
      env: jobEnv(io),
      release: releaser({ exec, checkouts }),
      slices: (prd, dir) => (io.mergedOf ?? ((n) => boardCount(n, { ...io, cwd: dir })))(prd),
      print: (line) => {
        println(stdout, line);
      },
      stop: stop.signal,
      keepLogsDays,
      limits,
      ...timing(io),
    });
  } finally {
    stop.release();
  }
}

async function job(args: string[], { cwd, stdout }: FreeIo): Promise<number> {
  const { positional, flags } = parseArgs('runner', args, { values: ['line', 'log', 'exit'] });
  if (positional.length || !flags.line || !flags.log || !flags.exit) throw usageError('usage: omni runner job --line <file> --log <file> --exit <file>');
  return runJobProcess({ cwd, files: { line: flags.line, log: flags.log, exit: flags.exit }, out: stdout });
}

/** One line on stderr, the app's words or ours, and the exit code of an `ask` or `answers` that did not go through. */
function refused(stderr: Out, words: string): number {
  println(stderr, `omni runner: ${words}`);
  return 1;
}

/** The text of `path`, read from `cwd`, or one line saying it cannot be read. */
function textOf(cwd: string, path: string): { text: string } | { refusal: string } {
  try {
    return { text: readFileSync(resolve(cwd, path), 'utf8') };
  } catch {
    return { refusal: `cannot read ${path}.` };
  }
}

/** The questions `path` holds, in `omni ask`'s file shape within the limits of a job's, or one line saying which field is wrong. */
function questionsFile(cwd: string, path: string): { questions: JobQuestionList } | { refusal: string } {
  const file = textOf(cwd, path);
  if ('refusal' in file) return file;
  let json: unknown;
  try {
    json = JSON.parse(file.text);
  } catch {
    return { refusal: `${path} does not read: (file): not JSON.` };
  }
  const read = readJobQuestions(json);
  return read.ok ? { questions: read.value } : { refusal: `${path} does not read: ${read.field}: ${read.message}.` };
}

/** The lead `path` holds, trimmed, or one line saying it is empty. */
function leadFile(cwd: string, path: string): { lead: string } | { refusal: string } {
  const file = textOf(cwd, path);
  if ('refusal' in file) return file;
  const lead = file.text.trim();
  return lead === '' ? { refusal: `${path} is empty: the lead says why the fix stopped.` } : { lead };
}

/** `ask`'s flags, checked: its questions file, its lead file and the issue. */
function askFlags(args: string[]): { file: string; lead: string; issue: IssueNumber } {
  const { positional, flags } = parseArgs('runner', args, { values: ['file', 'issue', 'lead'] });
  if (positional.length || !flags.file || !flags.issue || !flags.lead) throw usageError(ASK_USAGE);
  return { file: flags.file, lead: flags.lead, issue: issueArg('runner', '--issue', flags.issue) };
}

/** The Omni page where this command runs and the client of a job's questions route on it, or one line saying there is none. */
function questionsPage(io: FreeIo & RunnerCommandOptions): { askUrl: string; client: JobQuestionsApi } | { refusal: string } {
  const askUrl = askUrlOf(io.cwd, io.exec);
  if (askUrl === null) return { refusal: 'no Omni page is set (ask.url) in this checkout.' };
  return { askUrl, client: jobQuestionsApi({ askUrl, tokens: tokensOf(io), fetch: io.fetch ?? globalThis.fetch }) };
}

/** What a call to the app came to: its value, or the one line the app refused it with (or `unreachable`'s). Anything else is thrown. */
async function throughApp<T>(call: () => Promise<T>): Promise<{ value: T } | { refusal: string }> {
  try {
    return { value: await call() };
  } catch (error) {
    if (error instanceof RunnerRefused || error instanceof RunnerUnreachable) return { refusal: error.message };
    throw error;
  }
}

/** `ask --file <file> --issue <n> --lead <file>`: the questions a stopped skill asks on this job (PRD 2255). */
async function askOnJob(args: string[], io: FreeIo & RunnerCommandOptions): Promise<number> {
  const { cwd, stdout, stderr } = io;
  const flags = askFlags(args);
  const jobId = runnerJobOf(io.env)?.job;
  if (jobId === undefined) return refused(stderr, 'no job to ask on: OMNI_JOB is not set, this is not a runner job.');
  const questions = questionsFile(cwd, flags.file);
  if ('refusal' in questions) return refused(stderr, questions.refusal);
  const lead = leadFile(cwd, flags.lead);
  if ('refusal' in lead) return refused(stderr, lead.refusal);
  const page = questionsPage(io);
  if ('refusal' in page) return refused(stderr, page.refusal);
  const sent = await throughApp(() => page.client.ask(jobId, { issue: flags.issue, lead: lead.lead, questions: questions.questions }));
  if ('refusal' in sent) return refused(stderr, sent.refusal);
  println(stdout, waitingLine(page.askUrl, jobId));
  return 0;
}

/**
 * `github-token [--git get]`: the current token of the GitHub App this job runs as, or git's credential helper call (PRD 2433).
 * Git calls a helper with `get`, `store` or `erase` and reads nothing but what `get` prints.
 */
function githubTokenOfJob(args: string[], io: FreeIo & RunnerCommandOptions): number {
  const { positional, flags } = parseArgs('runner', args, { booleans: ['git'] });
  const [action, ...extra] = positional;
  if (extra.length || (flags.git !== true && action !== undefined)) throw usageError(GITHUB_TOKEN_USAGE);
  if (flags.git === true && action !== 'get') return 0;
  const read = jobGithubToken(runnerJobOf(io.env), io.home ?? homedir());
  if ('refusal' in read) return refused(io.stderr, read.refusal);
  println(io.stdout, flags.git === true ? `username=x-access-token\npassword=${read.token}` : read.token);
  return 0;
}

/** `answers <job>`: the job's questions and answers, as one line of JSON, for the run that resumes it (PRD 2255). */
async function answersOfJob(args: string[], io: FreeIo & RunnerCommandOptions): Promise<number> {
  const { stdout, stderr } = io;
  const { positional } = parseArgs('runner', args);
  const [jobId, ...extra] = positional;
  if (jobId === undefined || extra.length) throw usageError(ANSWERS_USAGE);
  const page = questionsPage(io);
  if ('refusal' in page) return refused(stderr, page.refusal);
  const row = await throughApp(() => page.client.answers(jobId));
  if ('refusal' in row) return refused(stderr, row.refusal === 'refused (404)' ? `no questions found for job ${jobId}.` : row.refusal);
  println(stdout, JSON.stringify(row.value));
  return 0;
}

/** `sender`: the line `/omni:pr` writes in a pull request this job opens: a person's, or the API key's (PRD 2433). */
function senderOfJob(args: string[], io: FreeIo & RunnerCommandOptions): number {
  if (args.length) throw usageError('usage: omni runner sender');
  const line = senderLine(io.vars.runnerSender);
  if (line) println(io.stdout, line);
  return 0;
}

/** What each word after `omni runner` runs; any other first word, or none, starts the runner. */
const SUBCOMMANDS = new Map<string, (args: string[], io: FreeIo & RunnerCommandOptions) => number | Promise<number>>([
  ['sender', senderOfJob],
  ['github-token', githubTokenOfJob],
  ['job', job],
  ['send', send],
  ['follow', followCommand],
  ['ask', askOnJob],
  ['answers', answersOfJob],
]);

export const runner = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & RunnerCommandOptions) {
    const [first, ...rest] = args;
    const subcommand = first === undefined ? undefined : SUBCOMMANDS.get(first);
    return subcommand === undefined ? start(args, io) : subcommand(rest, io);
  },
} satisfies FreeCommand;
