// `omni runner` through `main()` (PRD 1830, s2): a fixture checkout with its own origin, a fake Omni app
// (an injected `fetch`), a fake `claude` on the PATH and a fake tmux that runs the job's command as a
// plain child process. Nothing here calls GitHub, the Omni app or Claude.
import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcess, ExecFileSyncOptions } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { repoOfRemote } from '../../lib/runner/checkouts.ts';
import { senderLine } from '../../lib/runner/sender.ts';
import { tmuxArgs, tmuxTerminal } from '../../lib/runner/terminal.ts';
import type { JobSession, Terminal } from '../../lib/runner/terminal.ts';
import { main } from '../omni.ts';

const ASK = 'https://omni.test';
const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** A checkout `repos/widgets` of `acme/widgets`, its origin a bare repository beside it, and an empty home. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'omni-runner-'));
  const origin = join(root, 'remote', 'acme', 'widgets.git');
  mkdirSync(origin, { recursive: true });
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const seed = join(root, 'seed');
  mkdirSync(join(seed, '.omni-loop'), { recursive: true });
  writeFileSync(join(seed, '.omni-loop', 'config.yml'), `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${ASK}\n`);
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
      'echo "see https://github.com/acme/other/pull/9"',
      'echo "opened https://github.com/acme/widgets/pull/42"',
      'case "$line" in *fail*) exit 3 ;; esac',
      '',
    ].join('\n'),
  );
  chmodSync(join(bin, 'claude'), 0o755);
  return { root, repos, home, bin, checkout: join(repos, 'widgets') };
}

type Call = { method: string; path: string; body: unknown };

/** The fake Omni app: register answers `r1`, `next` hands each queued job once, then holds briefly. */
function fakeApp({ jobs = [], cancel = false, unreachable = 0, status, ended = false }: { jobs?: unknown[]; cancel?: boolean; unreachable?: number; status?: number; ended?: boolean } = {}) {
  const calls: Call[] = [];
  const queue = [...jobs];
  let failures = unreachable;
  const reply = (code: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status: code });
  const next = async (): Promise<Response> => {
    const job = queue.shift();
    if (job) return reply(200, job);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return reply(204);
  };
  const route = (pathname: string): Promise<Response> | Response => {
    if (status !== undefined) return reply(status, { error: 'no' });
    if (pathname === '/api/runners/register') return reply(200, { id: 'r1' });
    if (pathname === '/api/runners/next') return next();
    if (pathname.startsWith('/api/runners/jobs/')) return ended ? reply(409, { error: 'This job has ended.' }) : reply(200, cancel ? { cancel: true } : {});
    return reply(404);
  };
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const { pathname } = new URL(url);
    calls.push({ method: init.method ?? 'GET', path: pathname, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (failures > 0) {
      failures -= 1;
      throw new TypeError('fetch failed');
    }
    return route(pathname);
  };
  const updates = () => calls.filter((call) => call.path.startsWith('/api/runners/jobs/')).map((call) => call.body as Record<string, unknown>);
  return { calls, fetch, updates };
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

/** `claude` installed and signed in, and tmux, unless told otherwise; every other command runs. */
function fakeExec({ claude = true, signedIn = true }: { claude?: boolean; signedIn?: boolean } = {}) {
  return (file: string, args: readonly string[], options: ExecFileSyncOptions): string => {
    if (file === 'claude') {
      if (!claude) throw new Error('spawnSync claude ENOENT');
      if (args[0] === 'auth') return signedIn ? '{"loggedIn": true}' : '{"loggedIn": false}';
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

/** Starts `omni runner` on the fixture: its exit code once stopped, and what it printed. */
function startRunner(
  f: ReturnType<typeof fixture>,
  app: ReturnType<typeof fakeApp>,
  { args = [], exec = fakeExec(), tokens = memoryTokens(), sleep, terminal = fakeTerminal() }: {
    args?: string[]; exec?: ReturnType<typeof fakeExec>; tokens?: ReturnType<typeof memoryTokens>; sleep?: (ms: number) => Promise<void>; terminal?: ReturnType<typeof fakeTerminal>;
  } = {},
) {
  const stop = new AbortController();
  running.push(stop);
  const stdout = out();
  const stderr = out();
  const done = main(['runner', '--name', 'box-1', '--repos', f.repos, '--slots', '1', ...args], {
    cwd: f.root,
    stdout: stdout.stream,
    stderr: stderr.stream,
    exec,
    env: { PATH: `${f.bin}:${String(process.env.PATH)}` },
    tokens,
    home: f.home,
    fetch: app.fetch,
    terminal: terminal.terminal,
    stop: stop.signal,
    tickMs: 50,
    ...(sleep ? { sleep } : {}),
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
  it('registers, runs a claimed job in its worktree and tmux session, sends its log tail and its pull request, and keeps its branch', async () => {
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
    expect(existsSync(worktree)).toBe(false);
    expect(git(f.checkout, 'branch', '--list', 'agent/job-7').trim()).toBe('agent/job-7');
    expect(run.stdout.text()).toContain('runner box-1 registered · 1 slot · acme/widgets');
    expect(run.stdout.text()).toContain('job 7 done · https://github.com/acme/widgets/pull/42');
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

  it('refuses a bad --slots, --timeout or --name', async () => {
    for (const args of [['--slots', '9'], ['--slots', '0'], ['--timeout', '3d'], ['--name', 'a b']]) {
      const err = out();
      const code = await main(['runner', '--name', 'box-1', '--repos', '.', ...args], { stdout: out().stream, stderr: err.stream, env: {} });
      expect(code).toBe(2);
      expect(err.text()).toMatch(/^omni runner: /);
    }
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
