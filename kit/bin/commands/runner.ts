// `omni runner` (PRD 1830): makes this machine a runner of the Omni app, which runs the `/omni:` lines
// people send it from the app with Send to terminal.
//
//   omni runner --name <name> --repos <dir> [--slots 4] [--timeout 3h] [--keep-logs 14]
//               [--max-memory 85] [--min-disk 10] [--max-load 1.5]
//   omni runner sender
//   omni runner send '<line>' [--to <runner|fleet>]
//   omni runner follow <n>
//   omni runner job --line <file> --log <file> --exit <file>
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
// @<login> on runner <name>`, read from `OMNI_SENT_BY` and `OMNI_RUNNER`; either unset, it prints
// nothing. `job` is what runs inside a job's tmux session (`../../lib/runner/job.ts`): no person runs it.
//
// `send` queues a line for this repository's workspace and `follow` prints a PRD's job milestones
// until it ends (PRD 2251, `./runner-follow.ts`); both use the terminal's own sign-in.
//
// A test hands it `tokens`, `home`, `fetch`, `terminal`, `stop`, `sleep`, `now`, `tickMs`, `backoff` and
// `machine`, the reads its health samples are taken from.
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { loadContext } from '../../lib/context.ts';
import { runningKit } from '../../lib/init/bundle.ts';
import { runnerApi } from '../../lib/runner/api.ts';
import type { HealthLimits } from '../../lib/runner/api.ts';
import { listCheckouts } from '../../lib/runner/checkouts.ts';
import { DEFAULT_LIMITS } from '../../lib/runner/health.ts';
import type { MachineReads } from '../../lib/runner/health.ts';
import { runJobProcess } from '../../lib/runner/job.ts';
import { parseDuration } from '../../lib/runner/log.ts';
import { releaser } from '../../lib/runner/release.ts';
import { KEEP_LOGS_DAYS, runRunner } from '../../lib/runner/runner.ts';
import { senderLine } from '../../lib/runner/sender.ts';
import { missingTool, tmuxTerminal } from '../../lib/runner/terminal.ts';
import type { Terminal } from '../../lib/runner/terminal.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo } from '../io.ts';
import { followCommand, interrupts, send } from './runner-follow.ts';
import type { FollowOptions } from './runner-follow.ts';

const USAGE = "usage: omni runner --name <name> --repos <dir> [--slots 4] [--timeout 3h] [--keep-logs 14] [--max-memory 85] [--min-disk 10] [--max-load 1.5] | omni runner sender | omni runner send '<line>' [--to <runner|fleet>] | omni runner follow <n>";
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

/** The sign-in, the terminal, the home and the stop signal: a test's own, else the real ones. */
function wiring(io: FreeIo & RunnerCommandOptions) {
  const tokens = io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null });
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
      env: jobEnv(io),
      release: releaser({ exec, checkouts }),
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

export const runner = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & RunnerCommandOptions) {
    const [first, ...rest] = args;
    if (first === 'sender') {
      if (rest.length) throw usageError('usage: omni runner sender');
      const line = senderLine(io.vars.runnerSender);
      if (line) println(io.stdout, line);
      return 0;
    }
    if (first === 'job') return job(rest, io);
    if (first === 'send') return send(rest, io);
    if (first === 'follow') return followCommand(rest, io);
    return start(args, io);
  },
} satisfies FreeCommand;
