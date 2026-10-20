// `omni runner` through `main()` (PRD 1830, s2): a fixture checkout with its own origin, a fake Omni app
// (an injected `fetch`), a fake `claude` on the PATH and a fake tmux that runs the job's command as a
// plain child process. Nothing here calls GitHub, the Omni app or Claude, nor reads the real machine's
// health: each runner samples a fixed machine, quiet unless a test says otherwise (PRD 2102).
import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcess, ExecFileSyncOptions } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { repoOfRemote } from '../../lib/runner/checkouts.ts';
import type { MachineReads } from '../../lib/runner/health.ts';
import { senderLine } from '../../lib/runner/sender.ts';
import { tmuxArgs, tmuxTerminal } from '../../lib/runner/terminal.ts';
import type { JobSession, Terminal } from '../../lib/runner/terminal.ts';
import { main } from '../omni.ts';

const ASK = 'https://omni.test';
const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * A checkout `repos/widgets` of `acme/widgets`, its origin a bare repository beside it, and an empty home.
 * With `pin`, the repository's bin carries that omni version, as a built bundle does (PRD 2100, s4).
 */
function fixture({ pin }: { pin?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-runner-'));
  const origin = join(root, 'remote', 'acme', 'widgets.git');
  mkdirSync(origin, { recursive: true });
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const seed = join(root, 'seed');
  mkdirSync(join(seed, '.omni-loop'), { recursive: true });
  writeFileSync(join(seed, '.omni-loop', 'config.yml'), `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${ASK}\n`);
  if (pin !== undefined) {
    mkdirSync(join(seed, '.omni-loop', 'bin'), { recursive: true });
    writeFileSync(join(seed, '.omni-loop', 'bin', 'omni.mjs'), `define_OMNI_BUNDLE_default = { home: "acme/kit", version: "${pin}" };\n`);
  }
  git(seed, 'init', '-q', '-b', 'main');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', origin, 'main');
  const repos = join(root, 'repos');
  mkdirSync(repos);
  git(repos, 'clone', '-q', origin, 'widgets');
  mkdirSync(join(repos, 'not-a-checkout'));
  const home = join(root, 'home');
  mkdirSync(home);
  // The fake claude: prints the line it read on its standard input, sleeps when the line says so,
  // then prints a pull request of another repository and one of the job's.
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'claude'),
    [
      '#!/bin/sh',
      'line=$(cat)',
      'echo "claude read: $line"',
      'case "$line" in *sleep-*) sleep "${line##*sleep-}" ;; esac',
      'case "$line" in *lines-*) seq -f "line %g" 1 "${line##*lines-}" ;; esac',
      'echo "see https://github.com/acme/other/pull/9"',
      'echo "opened https://github.com/acme/widgets/pull/42"',
      'case "$line" in *push*) git push -q -u origin HEAD 2>/dev/null ;; esac',
      'case "$line" in *fail*) exit 3 ;; esac',
      '',
    ].join('\n'),
  );
  chmodSync(join(bin, 'claude'), 0o755);
  return { root, repos, home, bin, checkout: join(repos, 'widgets') };
}

type Call = { method: string; path: string; body: unknown };

/** The fake Omni app: register answers `r1`, `next` hands each queued job once, then holds briefly. */
function fakeApp({ jobs = [], cancel = false, unreachable = 0, status, ended = false, lost = 0, strict = false }: {
  jobs?: unknown[]; cancel?: boolean; unreachable?: number; status?: number; ended?: boolean;
  /** How many job reports carrying lines answer 503 first, storing nothing. */
  lost?: number;
  /** An app older than PRD 2175: a job report carrying `released` or `releaseError` answers 400. */
  strict?: boolean;
} = {}) {
  const calls: Call[] = [];
  const queue = [...jobs];
  let failures = unreachable;
  let losses = lost;
  /** The lines stored, by their number, each once: a report sent twice adds nothing, as the app's append. */
  const stored = new Map<number, string>();
  const store = (body: unknown): Response | null => {
    const { from, lines } = (body ?? {}) as { from?: number; lines?: string[] };
    if (from === undefined || lines === undefined) return null;
    if (losses > 0) {
      losses -= 1;
      return reply(503, { error: 'down' });
    }
    lines.forEach((text, index) => {
      if (!stored.has(from + index)) stored.set(from + index, text);
    });
    return null;
  };
  const reply = (code: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status: code });
  const next = async (): Promise<Response> => {
    const job = queue.shift();
    if (job) return reply(200, job);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return reply(204);
  };
  /** Whether a report carries what a runner released (PRD 2175). */
  const carriesRelease = (body: unknown): boolean => typeof body === 'object' && body !== null && ('released' in body || 'releaseError' in body);
  const report = (body: unknown): Response => {
    if (strict && carriesRelease(body)) return reply(400, { error: 'unknown keys' });
    if (ended) return reply(409, { error: 'This job has ended.' });
    return store(body) ?? reply(200, cancel ? { cancel: true } : {});
  };
  const route = (pathname: string, body: unknown): Promise<Response> | Response => {
    if (status !== undefined) return reply(status, { error: 'no' });
    if (pathname === '/api/runners/register') return reply(200, { id: 'r1' });
    if (pathname === '/api/runners/next') return next();
    if (pathname.startsWith('/api/runners/jobs/')) return report(body);
    return reply(404);
  };
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const { pathname } = new URL(url);
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method: init.method ?? 'GET', path: pathname, body });
    if (failures > 0) {
      failures -= 1;
      throw new TypeError('fetch failed');
    }
    return route(pathname, body);
  };
  const updates = () => calls.filter((call) => call.path.startsWith('/api/runners/jobs/')).map((call) => call.body as Record<string, unknown>);
  return { calls, fetch, updates, stored };
}

/** The fake tmux: runs the session's command as a child process, its variables added to this one's.
 * `dies` starts each session's command as one that ends at once, writing no exit code. */
function fakeTerminal({ dies = false }: { dies?: boolean } = {}) {
  const sessions: JobSession[] = [];
  const stopped: string[] = [];
  const children = new Map<string, ChildProcess>();
  const terminal: Terminal = {
    start(session) {
      sessions.push(session);
      const [file = '', ...args] = dies ? ['false'] : session.argv;
      children.set(session.name, spawn(file, args, { cwd: session.cwd, env: { ...process.env, ...session.env }, stdio: 'ignore' }));
    },
    stop(name) {
      stopped.push(name);
      children.get(name)?.kill('SIGKILL');
    },
    alive(name) {
      const child = children.get(name);
      return child !== undefined && child.exitCode === null && child.signalCode === null;
    },
  };
  return { terminal, sessions, stopped };
}

/**
 * The Omni plugin as `claude plugin list --json` shows it, and what `claude plugin update` does to it:
 * each update takes the next of `outcomes` (a version it moves the plugin to, `nothing`, or `fails`),
 * `nothing` once they run out (PRD 2100, s4).
 */
function fakePlugin({ version, installed = true, outcomes = [] }: { version: string; installed?: boolean; outcomes?: string[] }) {
  const state = { version };
  const calls: string[] = [];
  const handle = (args: readonly string[]): string => {
    const call = args.join(' ');
    calls.push(call);
    if (call === 'plugin list --json') return JSON.stringify(installed ? [{ id: 'omni@omni-loop', version: state.version, scope: 'user' }] : []);
    if (call === 'plugin update omni@omni-loop') {
      const outcome = outcomes.shift() ?? 'nothing';
      if (outcome === 'fails') throw Object.assign(new Error('Command failed: claude plugin update'), { stderr: 'could not reach the marketplace\n' });
      if (outcome !== 'nothing') state.version = outcome;
      return 'omni is up to date\n';
    }
    return '';
  };
  return { handle, calls, state, updates: () => calls.filter((call) => call === 'plugin update omni@omni-loop').length };
}

/**
 * GitHub as `gh` shows it to the runner's release (PRD 2175): `pr list` answers `prs`, every one an open
 * draft carrying `omni:in-progress`, `api …/comments` the comments of one, and every other call
 * succeeds. Each call is kept. Nothing reaches GitHub.
 */
function fakeGh(prs: { number: number; comments: string[] }[] = []) {
  const calls: string[] = [];
  const handle = (args: readonly string[]): string => {
    const call = args.join(' ');
    calls.push(call);
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(prs.map((pr) => ({ number: pr.number, isDraft: true, labels: [{ name: 'omni:in-progress' }] })));
    const comments = /^api repos\/[^/]+\/[^/]+\/issues\/(\d+)\/comments/.exec(call);
    if (comments) return `${JSON.stringify(prs.find((pr) => pr.number === Number(comments[1]))?.comments ?? [])}\n`;
    return '';
  };
  return { handle, calls };
}

/** A claim's status comment, as `/omni:pr` writes it for a runner's job. */
const claimedBy = (job: string): string => `<!-- omni-outbox-status -->\n**Status:** claimed\n- job: ${job} · runner box-1`;

/** `claude` installed and signed in, and tmux, unless told otherwise; `gh` answers from `gh`; every other command runs. */
function fakeExec({ claude = true, signedIn = true, plugin, gh = fakeGh() }: { claude?: boolean; signedIn?: boolean; plugin?: ReturnType<typeof fakePlugin>; gh?: ReturnType<typeof fakeGh> } = {}) {
  return (file: string, args: readonly string[], options: ExecFileSyncOptions): string => {
    if (file === 'gh') return gh.handle(args);
    if (file === 'claude') {
      if (!claude) throw new Error('spawnSync claude ENOENT');
      if (args[0] === 'auth') return signedIn ? '{"loggedIn": true}' : '{"loggedIn": false}';
      if (plugin && args[0] === 'plugin') return plugin.handle(args);
      return '2.0.0 (Claude Code)';
    }
    if (file === 'tmux') return 'tmux 3.4';
    return execFileSync(file, args, { ...options, encoding: 'utf8' });
  };
}

function memoryTokens(entry: Tokens | null = { access_token: 'access-1', refresh_token: 'refresh-1' }) {
  const store: Record<string, Tokens> = entry ? { 'omni.test': entry } : {};
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

function out() {
  const lines: string[] = [];
  return { lines, stream: { write: (text: string) => lines.push(text) }, text: () => lines.join('') };
}

const running: AbortController[] = [];
afterEach(() => {
  for (const stop of running.splice(0)) stop.abort();
});

const GB = 1024 ** 3;

/** A machine of 4 cores at load 1, with `memPercent` of its 16 GB used and 100 GB of disk free. */
function machineAt(memPercent = 50): MachineReads {
  const times = { user: 100, nice: 0, sys: 0, idle: 900, irq: 0 };
  return {
    cpus: () => [{ times }],
    loadavg: () => [1, 1, 1],
    cores: () => 4,
    totalmem: () => 16 * GB,
    freemem: () => ((100 - memPercent) / 100) * 16 * GB,
    meminfo: () => null,
    statfs: () => ({ bsize: 4096, blocks: (200 * GB) / 4096, bavail: (100 * GB) / 4096 }),
  };
}

/** Starts `omni runner` on the fixture: its exit code once stopped, and what it printed. */
function startRunner(
  f: ReturnType<typeof fixture>,
  app: ReturnType<typeof fakeApp>,
  { args = [], slots = 1, exec = fakeExec(), tokens = memoryTokens(), sleep, terminal = fakeTerminal(), env = {}, tickMs = 50, now, machine = machineAt() }: {
    args?: string[]; slots?: number; exec?: ReturnType<typeof fakeExec>; tokens?: ReturnType<typeof memoryTokens>; sleep?: (ms: number, signal?: AbortSignal) => Promise<void>; terminal?: ReturnType<typeof fakeTerminal>;
    env?: Record<string, string>; tickMs?: number; now?: () => number; machine?: MachineReads;
  } = {},
) {
  const stop = new AbortController();
  running.push(stop);
  const stdout = out();
  const stderr = out();
  const done = main(['runner', '--name', 'box-1', '--repos', f.repos, '--slots', String(slots), ...args], {
    cwd: f.root,
    stdout: stdout.stream,
    stderr: stderr.stream,
    exec,
    env: { PATH: `${f.bin}:${String(process.env.PATH)}`, ...env },
    tokens,
    home: f.home,
    fetch: app.fetch,
    terminal: terminal.terminal,
    stop: stop.signal,
    tickMs,
    machine,
    ...(sleep ? { sleep } : {}),
    ...(now ? { now } : {}),
  });
  return { done, stop, stdout, stderr, terminal };
}

/** Waits until `check` holds, or fails after a few seconds. */
async function until(check: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 8000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const lastStatus = (app: ReturnType<typeof fakeApp>) => app.updates().at(-1)?.status;
const ended = (app: ReturnType<typeof fakeApp>) => () => ['done', 'failed', 'cancelled'].includes(String(lastStatus(app)));

describe('omni runner', () => {
  it('registers, runs a claimed job in its worktree and tmux session, sends its log tail and its pull request, and cleans up after it', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 7, line: '/omni:yolo 1717', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    expect(await run.done).toBe(0);

    expect(app.calls[0]).toMatchObject({ method: 'POST', path: '/api/runners/register', body: { name: 'box-1', slots: 1, repos: ['acme/widgets'] } });
    expect(app.calls.find((call) => call.path === '/api/runners/next')).toBeDefined();
    const [session] = run.terminal.sessions;
    const worktree = join(f.home, 'wt', 'widgets-job-7');
    const log = join(f.home, 'logs', 'job-7.log');
    expect(session).toMatchObject({ name: 'job-7', cwd: worktree, env: { OMNI_SENT_BY: 'ada', OMNI_RUNNER: 'box-1' } });
    // The line reaches claude from a file, on its standard input: never on a command line.
    expect(session?.argv.join(' ')).not.toContain('1717');
    expect(session?.argv.slice(-6)).toEqual(['--line', join(f.home, 'logs', 'job-7.line'), '--log', log, '--exit', join(f.home, 'logs', 'job-7.exit')]);
    expect(readFileSync(log, 'utf8')).toContain('claude read: /omni:yolo 1717');

    const updates = app.updates();
    expect(updates[0]).toEqual({ status: 'running', logTail: '' });
    expect(updates.at(-1)).toMatchObject({ status: 'done', exitCode: 0, prUrl: 'https://github.com/acme/widgets/pull/42' });
    expect(updates.at(-1)?.logTail).toContain('claude read: /omni:yolo 1717');
    // PRD 1911: the worktree, its record and its unpushed branch are gone; the logs stay.
    expect(existsSync(worktree)).toBe(false);
    expect(git(f.checkout, 'branch', '--list', 'agent/job-*').trim()).toBe('');
    expect(git(f.checkout, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree '))).toHaveLength(1);
    expect(existsSync(log)).toBe(true);
    expect(run.stdout.text()).toContain('runner box-1 registered · 1 slot · acme/widgets');
    expect(run.stdout.text()).toContain('job 7 done · https://github.com/acme/widgets/pull/42');
    expect(run.stdout.text()).not.toContain('swept:');
  });

  it("keeps a job's branch once the job pushed it", async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 19, line: '/omni:yolo push', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    expect(await run.done).toBe(0);
    expect(existsSync(join(f.home, 'wt', 'widgets-job-19'))).toBe(false);
    expect(git(f.checkout, 'branch', '--list', 'agent/job-19').trim()).toBe('agent/job-19');
  });

  it('sweeps once registered, then after each hour, keeping logs --keep-logs days by its clock', async () => {
    const f = fixture();
    const now = Date.parse('2026-10-14T12:00:00Z');
    mkdirSync(join(f.home, 'logs'));
    const logAged = (name: string, days: number): string => {
      const path = join(f.home, 'logs', name);
      writeFileSync(path, 'x'.repeat(2048));
      const at = (now - days * 24 * 60 * 60 * 1000) / 1000;
      utimesSync(path, at, at);
      return path;
    };
    const old = logAged('job-1.log', 40);
    const kept = logAged('job-2.log', 20);
    const runnerLog = logAged('runner.log', 400);
    const hours: number[] = [];
    const sleep = async (ms: number) => {
      if (ms === 60 * 60 * 1000) {
        hours.push(ms);
        if (hours.length === 1) logAged('job-3.log', 31);
        if (hours.length <= 2) return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    };
    const app = fakeApp();
    const run = startRunner(f, app, { args: ['--keep-logs', '30'], sleep, now: () => now });
    await until(() => hours.length >= 3, 'two hours to pass');
    run.stop.abort();
    expect(await run.done).toBe(0);

    const swept = run.stdout.text().split('\n').filter((line) => line.startsWith('swept:'));
    expect(swept).toEqual(['swept: 0 worktrees, 0 branches, 1 log file · 2 KB freed', 'swept: 0 worktrees, 0 branches, 1 log file · 2 KB freed']);
    expect(run.stdout.text().indexOf('registered')).toBeLessThan(run.stdout.text().indexOf('swept:'));
    expect(existsSync(old)).toBe(false);
    expect(existsSync(join(f.home, 'logs', 'job-3.log'))).toBe(false);
    expect(existsSync(kept)).toBe(true);
    expect(existsSync(runnerLog)).toBe(true);
  });

  it('sweeps at start what a runner that died left: a stopped job\'s worktree and its branch', async () => {
    const f = fixture();
    const worktree = join(f.home, 'wt', 'widgets-job-5');
    git(f.checkout, 'worktree', 'add', '-q', '--no-track', '-b', 'agent/job-5', worktree, 'origin/main');
    const app = fakeApp();
    const run = startRunner(f, app);
    await until(() => run.stdout.text().includes('swept:'), 'the first sweep');
    run.stop.abort();
    expect(await run.done).toBe(0);
    expect(run.stdout.text()).toMatch(/swept: 1 worktree, 1 branch, 0 log files · \d+ KB freed/);
    expect(existsSync(worktree)).toBe(false);
    expect(git(f.checkout, 'branch', '--list', 'agent/job-5').trim()).toBe('');
  });

  it('starts every job session so that claude waits for its background agents to end (bug 1912)', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 12, line: '/omni:yolo 1717', repo: 'acme/widgets', sentBy: null }] });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    // `claude -p` stops a wave's agents 10 minutes after its last turn unless this reads 0.
    expect(run.terminal.sessions[0]?.env).toMatchObject({ CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' });
  });

  it('sends the log tail every tick while the job runs', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 8, line: '/omni:yolo sleep-1', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    const ticks = app.updates().filter((update) => update.status === 'running');
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.some((update) => String(update.logTail).includes('claude read: /omni:yolo sleep-1'))).toBe(true);
  });

  it('reports a run that fails with its exit code', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 9, line: '/omni:yolo fail', repo: 'acme/widgets', sentBy: null }] });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(app.updates().at(-1)).toMatchObject({ status: 'failed', exitCode: 3 });
    expect(run.terminal.sessions[0]?.env).not.toHaveProperty('OMNI_SENT_BY');
  });

  describe('the live lines (PRD 1904)', () => {
    type Report = { status?: string; logTail?: unknown; from?: number; lines?: string[] };
    const reports = (app: ReturnType<typeof fakeApp>) => app.updates() as Report[];
    const carrying = (app: ReturnType<typeof fakeApp>) => reports(app).filter((report) => report.lines !== undefined);
    const logLines = (f: ReturnType<typeof fixture>, id: number) => readFileSync(join(f.home, 'logs', `job-${String(id)}.log`), 'utf8').split('\n').filter((line, index, all) => index < all.length - 1 || line !== '');
    /** A tick that comes once job `id` wrote its exit code, so every line it printed waits in its log at
     * the runner's first look: a tick on the clock could catch the log half written under load, and cut
     * the reports elsewhere. Every other wait is the clock's, cut short by the stop. */
    const tickOnceEnded = (f: ReturnType<typeof fixture>, id: number) => {
      const tickMs = 1500;
      const exit = join(f.home, 'logs', `job-${String(id)}.exit`);
      const sleep = async (ms: number, signal?: AbortSignal): Promise<void> => {
        if (ms === tickMs) await until(() => existsSync(exit), `job ${String(id)} to write its exit code`);
        else await delay(ms, undefined, { signal }).catch(() => undefined);
      };
      return { tickMs, sleep };
    };

    it("sends a running job's lines after its cursor with from, never one already accepted, each report with its log tail", async () => {
      const f = fixture();
      const app = fakeApp({ jobs: [{ id: 30, line: '/omni:yolo sleep-1', repo: 'acme/widgets', sentBy: 'ada' }] });
      const run = startRunner(f, app);
      await until(ended(app), 'the job to end');
      run.stop.abort();
      expect(await run.done).toBe(0);

      const sent = carrying(app);
      expect(sent.some((report) => report.status === 'running')).toBe(true);
      let next = 1;
      for (const report of sent) {
        expect(report.from).toBe(next);
        expect(report.lines?.length).toBeGreaterThan(0);
        next += report.lines?.length ?? 0;
      }
      expect(sent.flatMap((report) => report.lines)).toEqual(logLines(f, 30));
      expect(sent.flatMap((report) => report.lines)).toContain('claude read: /omni:yolo sleep-1');
      for (const report of reports(app).slice(1)) expect(typeof report.logTail).toBe('string');
    });

    it('follows a report that fails with one carrying the same lines, and no line is stored twice', async () => {
      const f = fixture();
      const app = fakeApp({ jobs: [{ id: 31, line: '/omni:yolo sleep-1', repo: 'acme/widgets', sentBy: 'ada' }], lost: 1 });
      const run = startRunner(f, app);
      await until(ended(app), 'the job to end');
      run.stop.abort();
      await run.done;

      const [failed, again] = carrying(app);
      expect(failed?.from).toBe(1);
      expect(again?.from).toBe(1);
      expect(again?.lines?.slice(0, failed?.lines?.length)).toEqual(failed?.lines);
      expect([...app.stored.keys()]).toEqual(logLines(f, 31).map((_, index) => index + 1));
      expect([...app.stored.values()]).toEqual(logLines(f, 31));
    });

    it('sends 4,500 waiting lines in three reports of at most 2,000 lines and 256 KB, the last with the final status', async () => {
      const f = fixture();
      const app = fakeApp({ jobs: [{ id: 32, line: '/omni:yolo lines-4500', repo: 'acme/widgets', sentBy: 'ada' }] });
      const run = startRunner(f, app, tickOnceEnded(f, 32));
      await until(ended(app), 'the job to end');
      run.stop.abort();
      await run.done;

      const sent = carrying(app);
      expect(sent).toHaveLength(3);
      expect(sent.map((report) => report.from)).toEqual([1, 2001, 4001]);
      for (const report of sent) {
        expect(report.lines?.length).toBeLessThanOrEqual(2000);
        expect(Buffer.byteLength(JSON.stringify(report.lines))).toBeLessThanOrEqual(256 * 1024);
        expect(typeof report.logTail).toBe('string');
      }
      expect(sent.map((report) => report.status)).toEqual(['running', 'running', 'done']);
      expect(reports(app).at(-1)).toBe(sent.at(-1));
      expect(sent.flatMap((report) => report.lines)).toEqual(logLines(f, 32));
      expect(logLines(f, 32)).toContain('line 4500');
    });

    it('flushes in finish() every line left, the last one unended included, before the final status', async () => {
      const f = fixture();
      writeFileSync(join(f.bin, 'claude'), '#!/bin/sh\ncat >/dev/null\nprintf "first\\nlast, no newline"\n');
      const app = fakeApp({ jobs: [{ id: 33, line: '/omni:yolo 1904', repo: 'acme/widgets', sentBy: 'ada' }] });
      const run = startRunner(f, app, tickOnceEnded(f, 33));
      await until(ended(app), 'the job to end');
      run.stop.abort();
      await run.done;

      expect(carrying(app).flatMap((report) => report.lines)).toEqual(['first', 'last, no newline']);
      expect(reports(app).at(-1)).toMatchObject({ status: 'done', from: 1 });
    });
  });

  describe('the Claude token (PRD 1894)', () => {
    const CLAUDE_TOKEN = 'fake-claude-oauth-token-runner-0123456789';

    it("hands CLAUDE_CODE_OAUTH_TOKEN to each job's session when the runner has it, and never prints it", async () => {
      const f = fixture();
      const app = fakeApp({ jobs: [{ id: 21, line: '/omni:yolo 1894', repo: 'acme/widgets', sentBy: 'ada' }] });
      const run = startRunner(f, app, { env: { CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_TOKEN } });
      await until(ended(app), 'the job to end');
      run.stop.abort();
      expect(await run.done).toBe(0);
      expect(run.terminal.sessions[0]?.env).toMatchObject({ CLAUDE_CODE_OAUTH_TOKEN: CLAUDE_TOKEN });
      expect(run.stdout.text()).toContain('job 21 done');
      expect(run.stdout.text()).not.toContain(CLAUDE_TOKEN);
      expect(run.stderr.text()).not.toContain(CLAUDE_TOKEN);
      expect(JSON.stringify(app.calls)).not.toContain(CLAUDE_TOKEN);
    });

    for (const [what, env] of [['unset', {}], ['blank', { CLAUDE_CODE_OAUTH_TOKEN: ' ' }]] as const) {
      it(`starts the session with no CLAUDE_CODE_OAUTH_TOKEN when it is ${what}`, async () => {
        const f = fixture();
        const app = fakeApp({ jobs: [{ id: 22, line: '/omni:yolo 1894', repo: 'acme/widgets', sentBy: null }] });
        const run = startRunner(f, app, { env });
        await until(ended(app), 'the job to end');
        run.stop.abort();
        expect(await run.done).toBe(0);
        // PRD 2175: the job's own three variables, beside the PATH and bug 1912's.
        expect(Object.keys(run.terminal.sessions[0]?.env ?? {})).toEqual(['PATH', 'OMNI_JOB', 'OMNI_RUNNER', 'OMNI_UNATTENDED', 'CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS']);
      });
    }
  });

  it('refuses a line the app should never have sent, and starts nothing', async () => {
    const f = fixture();
    const app = fakeApp({
      jobs: [
        { id: 10, line: '/omni:brainstorm an idea', repo: 'acme/widgets', sentBy: 'ada' },
        { id: 11, line: '/omni:yolo 1; rm -rf ~', repo: 'acme/widgets', sentBy: 'ada' },
        { id: 12, line: '/omni:yolo 1', repo: 'acme/elsewhere', sentBy: 'ada' },
      ],
    });
    const run = startRunner(f, app);
    await until(() => app.updates().length === 3, 'three refusals');
    run.stop.abort();
    await run.done;
    expect(app.updates()).toEqual([
      { status: 'failed', reason: 'refused: /omni:brainstorm does not run on a runner' },
      { status: 'failed', reason: 'refused: the arguments hold a character other than letters, digits, spaces and ._/:#-' },
      { status: 'failed', reason: 'acme/elsewhere is not held by this runner' },
    ]);
    expect(run.terminal.sessions).toEqual([]);
  });

  it('kills a job past --timeout and reports it failed, reason timeout', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 13, line: '/omni:yolo sleep-5', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app, { args: ['--timeout', '1s'] });
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(app.updates().at(-1)).toMatchObject({ status: 'failed', reason: 'timeout' });
    expect(run.terminal.stopped).toEqual(['job-13']);
  });

  it('kills a job whose cancel waits and reports it cancelled', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 14, line: '/omni:yolo sleep-5', repo: 'acme/widgets', sentBy: 'ada' }], cancel: true });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(app.updates().at(-1)).toMatchObject({ status: 'cancelled' });
    expect(run.terminal.stopped).toEqual(['job-14']);
    expect(existsSync(join(f.home, 'wt', 'widgets-job-14'))).toBe(false);
  });

  it('stops a job whose report the app answers 409, and keeps running', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 17, line: '/omni:yolo sleep-5', repo: 'acme/widgets', sentBy: 'ada' }], ended: true });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(run.terminal.stopped).toEqual(['job-17']);
    expect(run.stdout.text()).not.toContain('refused (409)');
  });

  it('fails a job whose session ends before it writes its exit code, at once, not after the timeout', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 18, line: '/omni:yolo 1717', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app, { terminal: fakeTerminal({ dies: true }) });
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(app.updates().at(-1)).toMatchObject({ status: 'failed', reason: 'the job stopped before it wrote its exit code' });
  });

  it('tries an unreachable app again after 5 s, doubling up to 60 s, while its jobs keep running', async () => {
    const f = fixture();
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
      await new Promise((resolve) => setTimeout(resolve, 1));
    };
    const app = fakeApp({ unreachable: 7 });
    const run = startRunner(f, app, { sleep });
    await until(() => run.stdout.text().includes('registered'), 'the runner to register');
    run.stop.abort();
    expect(await run.done).toBe(0);
    expect(waits.slice(0, 7)).toEqual([5000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000]);
    expect(run.stdout.text()).toContain('the app is unreachable');
  });

  it('keeps a running job going while its next call cannot reach the app', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 15, line: '/omni:yolo sleep-1', repo: 'acme/widgets', sentBy: 'ada' }] });
    const flaky = { ...app, fetch: async (url: string, init: RequestInit) => {
      const { pathname } = new URL(url);
      if (pathname === '/api/runners/next' && app.calls.some((call) => call.path === '/api/runners/next')) {
        app.calls.push({ method: 'GET', path: pathname, body: null });
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new TypeError('fetch failed');
      }
      return app.fetch(url, init);
    } };
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
      await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 50)));
    };
    const run = startRunner(f, flaky, { args: ['--slots', '2'], sleep });
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(app.updates().at(-1)).toMatchObject({ status: 'done' });
    expect(waits).toContain(5000);
  });

  it('stops on a refused sign-in with no sign-in (omni setup-token)', async () => {
    const f = fixture();
    const app = fakeApp({ status: 401 });
    const run = startRunner(f, app, { tokens: memoryTokens({ access_token: 'access-1' }) });
    expect(await run.done).toBe(1);
    expect(run.stdout.text().trim().split('\n').at(-1)).toBe('no sign-in (omni setup-token)');
  });

  it('stops at the next call once the routes are gone, refused (404)', async () => {
    const f = fixture();
    const app = fakeApp({ status: 404 });
    const run = startRunner(f, app);
    expect(await run.done).toBe(1);
    expect(run.stdout.text()).toContain('refused (404)');
  });

  it('refuses to register when claude is missing, or signed out', async () => {
    for (const [exec, line] of [
      [fakeExec({ claude: false }), 'omni runner: claude is not installed'],
      [fakeExec({ signedIn: false }), 'omni runner: claude is not signed in'],
    ] as const) {
      const f = fixture();
      const app = fakeApp();
      const run = startRunner(f, app, { exec });
      expect(await run.done).toBe(1);
      expect(run.stderr.text()).toContain(line);
      expect(app.calls).toEqual([]);
    }
  });

  it('on Ctrl-C stops taking jobs and waits for the running ones', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 16, line: '/omni:yolo sleep-1', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app);
    await until(() => run.terminal.sessions.length === 1, 'the job to start');
    run.stop.abort();
    expect(await run.done).toBe(0);
    expect(lastStatus(app)).toBe('done');
    expect(run.stdout.text()).toContain('stopping: waiting for 1 running job');
    expect(run.stdout.text().trim().split('\n').at(-1)).toBe('runner box-1 stopped');
  });

  describe('the limits it pauses at (PRD 2102)', () => {
    const healthReports = (app: ReturnType<typeof fakeApp>) => app.calls.filter((call) => call.path === '/api/runners/r1/health').map((call) => call.body as Record<string, unknown>);
    const nexts = (app: ReturnType<typeof fakeApp>) => app.calls.filter((call) => call.path === '/api/runners/next');

    it('pauses at 85 % of memory, 10 GB of disk and 1.5 × the cores when no flag says otherwise, and reports them', async () => {
      const f = fixture();
      const app = fakeApp();
      const run = startRunner(f, app);
      await until(() => healthReports(app).length > 0 && nexts(app).length > 0, 'a health report and a next');
      run.stop.abort();
      expect(await run.done).toBe(0);
      expect(healthReports(app)[0]).toMatchObject({ paused: null, limits: { maxMemory: 85, minDiskGb: 10, maxLoad: 1.5 } });
    });

    it('pauses at --max-memory, --min-disk and --max-load, opening no next, and reports why and at which limits', async () => {
      const f = fixture();
      const app = fakeApp();
      const run = startRunner(f, app, { args: ['--max-memory', '70', '--min-disk', '20', '--max-load', '1'], machine: machineAt(75) });
      await until(() => healthReports(app).length > 0, 'a health report');
      await delay(100);
      run.stop.abort();
      expect(await run.done).toBe(0);
      expect(healthReports(app)[0]).toMatchObject({ paused: 'memory 75%', limits: { maxMemory: 70, minDiskGb: 20, maxLoad: 1 } });
      expect(nexts(app)).toEqual([]);
      expect(run.stdout.text()).toContain('paused: memory 75%');
    });

    it('takes a decimal limit, and 100 % of memory or 0 GB of disk as no limit at all', async () => {
      const f = fixture();
      const app = fakeApp();
      const run = startRunner(f, app, { args: ['--max-memory', '100', '--min-disk', '0', '--max-load', '2.5'], machine: machineAt(99) });
      await until(() => nexts(app).length > 0, 'a next');
      run.stop.abort();
      expect(await run.done).toBe(0);
      expect(healthReports(app)[0]).toMatchObject({ paused: null, limits: { maxMemory: 100, minDiskGb: 0, maxLoad: 2.5 } });
    });

    it('refuses a limit out of range in plain words, before it registers', async () => {
      for (const [args, words] of [
        [['--max-memory', '0'], '--max-memory is the share of memory used, in percent, the runner pauses above: a number from 1 to 100, got "0".'],
        [['--max-memory', '101'], '--max-memory is the share of memory used, in percent, the runner pauses above: a number from 1 to 100, got "101".'],
        [['--max-memory', '1e2'], 'a number from 1 to 100, got "1e2".'],
        [['--min-disk', '-1'], '--min-disk is the free disk, in GB, the runner pauses below: a number of 0 or more, got "-1".'],
        [['--min-disk', 'lots'], 'a number of 0 or more, got "lots".'],
        [['--max-load', '0'], '--max-load is the 1-minute load, in times the cores, the runner pauses above: a number above 0, got "0".'],
        [['--max-load', '-2'], 'a number above 0, got "-2".'],
      ] as const) {
        const err = out();
        const app = fakeApp();
        const code = await main(['runner', '--name', 'box-1', '--repos', '.', ...args], { stdout: out().stream, stderr: err.stream, env: {}, fetch: app.fetch });
        expect(code).toBe(2);
        expect(err.text()).toMatch(/^omni runner: /);
        expect(err.text()).toContain(words);
        expect(app.calls).toEqual([]);
      }
    });
  });

  it('refuses a bad --slots, --timeout, --name or --keep-logs', async () => {
    for (const args of [['--slots', '9'], ['--slots', '0'], ['--timeout', '3d'], ['--name', 'a b'], ['--keep-logs', '0'], ['--keep-logs', 'x'], ['--keep-logs', '1.5']]) {
      const err = out();
      const code = await main(['runner', '--name', 'box-1', '--repos', '.', ...args], { stdout: out().stream, stderr: err.stream, env: {} });
      expect(code).toBe(2);
      expect(err.text()).toMatch(/^omni runner: /);
    }
  });
});

describe('omni runner: a dead job\'s claims (PRD 2175, s2)', () => {
  /** A worktree a runner that died left for job `id`, on its branch. */
  const strand = (f: ReturnType<typeof fixture>, id: string): void => {
    git(f.checkout, 'worktree', 'add', '-q', '--no-track', '-b', `agent/job-${id}`, join(f.home, 'wt', `widgets-job-${id}`), 'origin/main');
  };

  it('starts every job session with OMNI_JOB, OMNI_RUNNER and OMNI_UNATTENDED, a job with no sender too', async () => {
    const f = fixture();
    const app = fakeApp({ jobs: [{ id: 21, line: '/omni:yolo 1717', repo: 'acme/widgets', sentBy: null }] });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(run.terminal.sessions[0]?.env).toMatchObject({ OMNI_JOB: '21', OMNI_RUNNER: 'box-1', OMNI_UNATTENDED: '1' });
    expect(run.terminal.sessions[0]?.env).not.toHaveProperty('OMNI_SENT_BY');
  });

  it('releases the claims a failed job still holds, and its last report carries them', async () => {
    const f = fixture();
    const gh = fakeGh([{ number: 1908, comments: [claimedBy('22')] }, { number: 1909, comments: [claimedBy('other')] }]);
    const app = fakeApp({ jobs: [{ id: 22, line: '/omni:yolo fail', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app, { exec: fakeExec({ gh }) });
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(app.updates().at(-1)).toMatchObject({ status: 'failed', exitCode: 3, released: [1908], releaseError: null });
    expect(gh.calls).toContain('pr list --repo acme/widgets --state open --draft --label omni:in-progress --limit 100 --json number,isDraft,labels');
    expect(gh.calls).toContain('pr edit 1908 --repo acme/widgets --remove-label omni:in-progress --add-label omni:released');
    expect(gh.calls.filter((call) => call.startsWith('pr edit'))).toHaveLength(1);
    expect(gh.calls.find((call) => call.startsWith('pr comment 1908'))).toContain('Released: runner job `22` on `box-1` ended (`exit code 3`)');
    expect(run.stdout.text()).toContain('job 22 released #1908');
  });

  it('releases on every ending: done, timeout and cancelled, each named in the alarm', async () => {
    const cases = [
      { id: 23, line: '/omni:yolo 1717', args: [], cancel: false, reason: 'done' },
      { id: 24, line: '/omni:yolo sleep-5', args: ['--timeout', '1s'], cancel: false, reason: 'timeout' },
      { id: 25, line: '/omni:yolo sleep-5', args: [], cancel: true, reason: 'cancelled' },
    ];
    for (const { id, line, args, cancel, reason } of cases) {
      const f = fixture();
      const gh = fakeGh([{ number: 40, comments: [claimedBy(String(id))] }]);
      const app = fakeApp({ jobs: [{ id, line, repo: 'acme/widgets', sentBy: 'ada' }], cancel });
      const run = startRunner(f, app, { args, exec: fakeExec({ gh }) });
      await until(ended(app), `job ${String(id)} to end`);
      run.stop.abort();
      await run.done;
      expect(app.updates().at(-1)).toMatchObject({ released: [40], releaseError: null });
      expect(gh.calls.find((call) => call.startsWith('pr comment 40'))).toContain(`ended (\`${reason}\`)`);
    }
  });

  it('reports a release that failed, and the job\'s status still reaches the app', async () => {
    const f = fixture();
    const refusing = {
      calls: [] as string[],
      handle: (): string => {
        throw Object.assign(new Error('Command failed: gh'), { stderr: 'HTTP 401: Bad credentials\n' });
      },
    };
    const app = fakeApp({ jobs: [{ id: 26, line: '/omni:yolo 1717', repo: 'acme/widgets', sentBy: 'ada' }] });
    const run = startRunner(f, app, { exec: fakeExec({ gh: refusing }) });
    await until(ended(app), 'the job to end');
    run.stop.abort();
    await run.done;
    expect(app.updates().at(-1)).toMatchObject({ status: 'done', released: [], releaseError: 'HTTP 401: Bad credentials' });
    expect(run.stdout.text()).toContain('job 26 could not release its claims: HTTP 401: Bad credentials');
  });

  it('sends the last report again without what it released to an app that refuses it, and keeps running', async () => {
    const f = fixture();
    const gh = fakeGh([{ number: 1908, comments: [claimedBy('27')] }]);
    const app = fakeApp({ jobs: [{ id: 27, line: '/omni:yolo 1717', repo: 'acme/widgets', sentBy: 'ada' }], strict: true });
    const run = startRunner(f, app, { exec: fakeExec({ gh }) });
    await until(ended(app), 'the job to end');
    run.stop.abort();
    expect(await run.done).toBe(0);
    const last = app.updates().at(-1);
    expect(last).toMatchObject({ status: 'done', prUrl: 'https://github.com/acme/widgets/pull/42' });
    expect(last).not.toHaveProperty('released');
    expect(run.stdout.text()).not.toContain('refused (400)');
  });

  it('releases, at the first sweep, the claims of a job a runner that died left, and reports them as runner lost', async () => {
    const f = fixture();
    strand(f, 'old1');
    const gh = fakeGh([{ number: 1908, comments: [claimedBy('old1')] }]);
    const app = fakeApp();
    const run = startRunner(f, app, { exec: fakeExec({ gh }) });
    await until(() => app.calls.some((call) => call.path === '/api/runners/jobs/old1'), 'the lost job\'s report');
    run.stop.abort();
    expect(await run.done).toBe(0);
    expect(app.calls.find((call) => call.path === '/api/runners/jobs/old1')?.body).toEqual({ status: 'failed', released: [1908], releaseError: null });
    expect(gh.calls.find((call) => call.startsWith('pr comment 1908'))).toContain('ended (`runner lost`)');
    expect(run.stdout.text()).toContain('job old1 released #1908');
  });

  it('sends nothing for a lost job that held no claim', async () => {
    const f = fixture();
    strand(f, 'old2');
    const app = fakeApp();
    const run = startRunner(f, app);
    await until(() => run.stdout.text().includes('swept:'), 'the first sweep');
    run.stop.abort();
    await run.done;
    expect(app.calls.filter((call) => call.path.startsWith('/api/runners/jobs/'))).toEqual([]);
  });

  it('prints one line when the app refuses a lost job\'s release report, and keeps running', async () => {
    const f = fixture();
    strand(f, 'old3');
    const app = fakeApp({ strict: true });
    const run = startRunner(f, app, { exec: fakeExec({ gh: fakeGh([{ number: 5, comments: [claimedBy('old3')] }]) }) });
    await until(() => run.stdout.text().includes('its release was not reported'), 'the refused report');
    run.stop.abort();
    expect(await run.done).toBe(0);
    expect(run.stdout.text()).toContain('job old3: its release was not reported (refused (400))');
  });
});

describe('omni runner: the Omni plugin (PRD 2100, s4)', () => {
  const PINNED = '0.0.450';
  const jobsOn = (...ids: number[]) => ids.map((id) => ({ id, line: '/omni:yolo 1717', repo: 'acme/widgets', sentBy: 'ada' }));
  /** The calls of `claude plugin` the runner makes at start: its sweep reads the plugin, updates it, reads it again. */
  const SWEEP_CALLS = ['plugin list --json', 'plugin marketplace update omni-loop', 'plugin update omni@omni-loop', 'plugin list --json'];
  const failure = (app: ReturnType<typeof fakeApp>) => app.updates().find((update) => update.status === 'failed')?.reason;
  const stop = async (run: ReturnType<typeof startRunner>) => {
    run.stop.abort();
    expect(await run.done).toBe(0);
  };

  it("brings an older plugin up to the job repository's omni before claude starts, once for two slots, and prints the change", async () => {
    const f = fixture({ pin: PINNED });
    // The update the sweep runs at start changes nothing, so the jobs find the plugin old; the next moves it.
    const plugin = fakePlugin({ version: '0.0.440', outcomes: ['nothing', PINNED] });
    const started: string[] = [];
    const base = fakeTerminal();
    const terminal = {
      ...base,
      terminal: {
        ...base.terminal,
        start(session: JobSession) {
          started.push(plugin.state.version);
          base.terminal.start(session);
        },
      },
    };
    const app = fakeApp({ jobs: jobsOn(1, 2) });
    const run = startRunner(f, app, { slots: 2, exec: fakeExec({ plugin }), terminal });
    await until(() => run.stdout.text().includes('job 1 done') && run.stdout.text().includes('job 2 done'), 'both jobs to end');
    await stop(run);

    expect(plugin.updates()).toBe(2);
    expect(started).toEqual([PINNED, PINNED]);
    expect(run.stdout.text().match(/omni plugin v0\.0\.440 → v0\.0\.450/g)).toHaveLength(1);
  });

  it('fails a job whose plugin is still older after the update, with the reason, before claude starts', async () => {
    const f = fixture({ pin: PINNED });
    const plugin = fakePlugin({ version: '0.0.440' });
    const app = fakeApp({ jobs: jobsOn(3) });
    const run = startRunner(f, app, { exec: fakeExec({ plugin }) });
    await until(ended(app), 'the job to end');
    await stop(run);

    const reason = "omni plugin v0.0.440 is older than acme/widgets's omni v0.0.450: claude plugin update failed: omni is up to date";
    expect(failure(app)).toBe(reason);
    expect(run.terminal.sessions).toEqual([]);
    expect(run.stdout.text()).toContain(`job 3 failed · ${reason}`);
    expect(existsSync(join(f.home, 'wt', 'widgets-job-3'))).toBe(false);
    expect(git(f.checkout, 'branch', '--list', 'agent/job-*').trim()).toBe('');
  });

  it('says the update failed, and fails the job with the line the update ended on', async () => {
    const f = fixture({ pin: PINNED });
    const plugin = fakePlugin({ version: '0.0.440', outcomes: ['fails', 'fails'] });
    const app = fakeApp({ jobs: jobsOn(4) });
    const run = startRunner(f, app, { exec: fakeExec({ plugin }) });
    await until(ended(app), 'the job to end');
    await stop(run);

    expect(failure(app)).toBe("omni plugin v0.0.440 is older than acme/widgets's omni v0.0.450: claude plugin update failed: could not reach the marketplace");
    expect(run.terminal.sessions).toEqual([]);
    expect(run.stdout.text().match(/^omni plugin update failed: could not reach the marketplace$/gm)).toHaveLength(2);
  });

  it('fails a job whose plugin is not installed with the line to install it, and updates nothing for it', async () => {
    const f = fixture({ pin: PINNED });
    const plugin = fakePlugin({ version: '0.0.440', installed: false });
    const app = fakeApp({ jobs: jobsOn(5) });
    const run = startRunner(f, app, { exec: fakeExec({ plugin }) });
    await until(ended(app), 'the job to end');
    await stop(run);

    expect(failure(app)).toBe('the omni plugin is not installed: claude plugin install omni@omni-loop');
    expect(run.terminal.sessions).toEqual([]);
    expect(plugin.updates()).toBe(1);
  });

  it.each(['0.0.450', '0.0.462'])('starts no update for a plugin at %s, as new as the pinned omni or newer', async (version) => {
    const f = fixture({ pin: PINNED });
    const plugin = fakePlugin({ version });
    const app = fakeApp({ jobs: jobsOn(6) });
    const run = startRunner(f, app, { exec: fakeExec({ plugin }) });
    await until(ended(app), 'the job to end');
    await stop(run);

    expect(lastStatus(app)).toBe('done');
    expect(plugin.calls).toEqual([...SWEEP_CALLS, 'plugin list --json']);
  });

  it('asks nothing of a repository that pins no omni', async () => {
    const f = fixture();
    const plugin = fakePlugin({ version: '0.0.1' });
    const app = fakeApp({ jobs: jobsOn(7) });
    const run = startRunner(f, app, { exec: fakeExec({ plugin }) });
    await until(ended(app), 'the job to end');
    await stop(run);

    expect(lastStatus(app)).toBe('done');
    expect(plugin.calls).toEqual(SWEEP_CALLS);
  });

  it('runs a job whose plugin list does not read, with its log starting on the line that says so', async () => {
    const f = fixture({ pin: PINNED });
    const app = fakeApp({ jobs: jobsOn(9) });
    const run = startRunner(f, app);
    await until(ended(app), 'the job to end');
    await stop(run);

    expect(lastStatus(app)).toBe('done');
    const log = readFileSync(join(f.home, 'logs', 'job-9.log'), 'utf8').split('\n');
    expect(log[0]).toBe('omni plugin version not read: claude plugin list was unreadable');
    expect(log).toContain('claude read: /omni:yolo 1717');
  });

  it('updates the plugin at start and every hour, and prints a line only on a change or a failure', async () => {
    const f = fixture();
    const plugin = fakePlugin({ version: '0.0.440', outcomes: ['0.0.441', 'nothing', 'fails'] });
    const hours: number[] = [];
    const sleep = async (ms: number) => {
      if (ms === 60 * 60 * 1000) {
        hours.push(ms);
        if (hours.length <= 2) return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    };
    const run = startRunner(f, fakeApp(), { exec: fakeExec({ plugin }), sleep });
    await until(() => hours.length >= 3, 'two hours to pass');
    await stop(run);

    const lines = run.stdout.text().split('\n').filter((line) => line.startsWith('omni plugin'));
    expect(lines).toEqual(['omni plugin v0.0.440 → v0.0.441', 'omni plugin update failed: could not reach the marketplace']);
    expect(plugin.updates()).toBeGreaterThanOrEqual(3);
  });
});

describe('omni runner sender', () => {
  const sender = async (env: Record<string, string>) => {
    const stdout = out();
    const code = await main(['runner', 'sender'], { stdout: stdout.stream, stderr: out().stream, env });
    return { code, text: stdout.text() };
  };

  it("prints the line /omni:pr writes when the job's sender and runner are set, and nothing otherwise", async () => {
    expect(await sender({ OMNI_SENT_BY: 'ada', OMNI_RUNNER: 'box-1' })).toEqual({ code: 0, text: 'Sent from the Omni app by @ada on runner box-1\n' });
    expect(await sender({ OMNI_SENT_BY: 'ada' })).toEqual({ code: 0, text: '' });
    expect(await sender({})).toEqual({ code: 0, text: '' });
  });

  it('reads a login given with its @ once', () => {
    expect(senderLine({ sentBy: '@ada', runner: 'box-1' })).toBe('Sent from the Omni app by @ada on runner box-1');
    expect(senderLine({ sentBy: ' ', runner: 'box-1' })).toBeNull();
  });
});

describe('the runner pieces', () => {
  it('starts a tmux session detached, named, in its folder, with its variables, and the command as separate arguments', () => {
    expect(tmuxArgs({ name: 'job-7', cwd: '/w', env: { OMNI_RUNNER: 'box-1' }, argv: ['node', 'omni.mjs', 'runner', 'job'] })).toEqual([
      'new-session', '-d', '-s', 'job-7', '-c', '/w', '-e', 'OMNI_RUNNER=box-1', 'node', 'omni.mjs', 'runner', 'job',
    ]);
  });

  it('reads a tmux session as alive while a pane runs, and as ended once every pane is dead or the session is gone', () => {
    const panes = (out: string | null) => tmuxTerminal(() => {
      if (out === null) throw new Error("can't find session: job-7");
      return out;
    });
    expect(panes('0\n').alive('job-7')).toBe(true);
    expect(panes('1\n').alive('job-7')).toBe(false);
    expect(panes(null).alive('job-7')).toBe(false);
  });

  it("reads a checkout's origin as owner/name", () => {
    expect(repoOfRemote('git@github.com:acme/widgets.git\n')).toBe('acme/widgets');
    expect(repoOfRemote('https://github.com/acme/widgets')).toBe('acme/widgets');
    expect(repoOfRemote('/tmp/remote/acme/widgets.git')).toBe('acme/widgets');
    expect(repoOfRemote('widgets')).toBeNull();
  });
});
