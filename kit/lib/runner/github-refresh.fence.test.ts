// The fence (PRD 2809, s3), on the runner's side: once a job has ended on the app (a resume replaced it, or a
// person cancelled it), the app refuses every report on it with a 409, and its GitHub token refresh too. The
// runner stops that job's session at once, and its cleanup runs, the save first (s2): a session that left work
// origin lacks keeps its folder and a bundle of that work; one that left none has its folder removed as before.
//
// `runRunner()` on the real app client (`runnerApi()`) over a fake fetch answering as the app does, a fake terminal
// whose session writes into the job's worktree, and a real temporary checkout with a bare origin. No test calls
// GitHub or holds a real token.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import type { ExecText } from '../context.ts';
import { runnerApi } from './api.ts';
import type { JobUpdate, RunnerApi, RunnerJob } from './api.ts';
import { savePaths } from './checkpoint.ts';
import { keepGithubToken } from './github-refresh.ts';
import { githubTokenFile, saveGithubToken } from './github-token.ts';
import { runRunner } from './runner.ts';
import type { Terminal } from './terminal.ts';

const GB = 1024 ** 3;
const T0 = Date.parse('2026-11-13T12:00:00.000Z');
const MIN = 60_000;
const TOKEN = ['ghs', 'fakeFenceTokenOfTheJob0123456789ABCDE'].join('_');
const TOKEN_COMMAND = ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'];
/** The app's words for a refresh of a job that has ended (`apps/galaxy/src/runners/runners.service.ts`). */
const ENDED = 'This job has ended: it takes no new GitHub token.';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** Git runs for real; anything else the runner runs (the plugin's `claude`) answers nothing. */
const exec: ExecText = (file, args, options) => (file === 'git' ? execFileSync(file, args, { ...options, encoding: 'utf8' }) : '');

const job = (expiresAt: string): RunnerJob => ({
  id: '7', line: '/omni:yolo 7', repo: 'acme/widgets', sentBy: 'ada', sentByKey: null, allowedSkills: [],
  github: { token: TOKEN, expiresAt, login: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' },
});

/** A machine that is never under pressure. */
const machine = () => ({
  cpus: () => [{ times: { user: 300, nice: 0, sys: 0, idle: 700, irq: 0 } }],
  loadavg: (): [number, number, number] => [0.1, 0.1, 0.1],
  cores: () => 1,
  totalmem: () => 8 * GB,
  freemem: () => 6 * GB,
  meminfo: () => null,
  statfs: () => ({ bsize: 1024, blocks: (100 * GB) / 1024, bavail: (80 * GB) / 1024 }),
});

/** A checkout `acme/widgets` with a bare origin holding one commit, in a fresh home. */
function checkoutOf(): { home: string; checkout: string } {
  const root = mkdtempSync(join(tmpdir(), 'omni-fence-'));
  const origin = join(root, 'widgets.git');
  mkdirSync(origin);
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const checkout = join(root, 'repos', 'widgets');
  mkdirSync(checkout, { recursive: true });
  git(checkout, 'init', '-q', '-b', 'main');
  writeFileSync(join(checkout, 'README.md'), 'widgets\n');
  git(checkout, 'add', '-A');
  git(checkout, 'commit', '-q', '-m', 'seed');
  git(checkout, 'remote', 'add', 'origin', origin);
  git(checkout, 'push', '-q', '-u', 'origin', 'main');
  const home = join(root, 'home');
  mkdirSync(home);
  return { home, checkout };
}

/**
 * The real app client over a fake fetch: a job report is answered `{cancel: false}` until `endAfter` of them were
 * taken, then 409 as for a job that has ended; a token refresh is 409 in the app's words.
 */
function endingApp(endAfter: number) {
  const held: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const asked: string[] = [];
  let reports = 0;
  const client = runnerApi({
    askUrl: 'https://omni.test/',
    tokens: { read: (host) => held[host] ?? null, write: (host, tokens) => { held[host] = tokens; } },
    fetch: (url: string) => {
      asked.push(new URL(url).pathname);
      if (url.endsWith('/github-token')) return Promise.resolve(Response.json({ error: ENDED }, { status: 409 }));
      reports += 1;
      return Promise.resolve(reports > endAfter ? Response.json({ error: 'This job has ended.' }, { status: 409 }) : Response.json({ cancel: false }));
    },
  });
  return { client, asked };
}

/**
 * Runs job 7 on box-1 against `endingApp(endAfter)` until its last report. Its session, once started, does
 * `work` in the job's worktree and never exits on its own.
 */
async function runEnding(endAfter: number, work: (worktree: string) => void, expiresAt = new Date(T0 + 60 * MIN).toISOString()) {
  const { home, checkout } = checkoutOf();
  const app = endingApp(endAfter);
  const stop = new AbortController();
  const updates: JobUpdate[] = [];
  const stopped: string[] = [];
  const clock = { now: T0 };
  let handed = false;
  const api: RunnerApi = {
    register: () => Promise.resolve({ id: 'r1' }),
    next: (_runner, signal) => {
      if (!handed) {
        handed = true;
        return Promise.resolve(job(expiresAt));
      }
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve(null);
        }, { once: true });
      });
    },
    update: async (id, update) => {
      updates.push(update);
      const answer = await app.client.update(id, update);
      if (update.status !== 'running') stop.abort();
      return answer;
    },
    githubToken: (id) => app.client.githubToken(id),
    health: () => Promise.resolve(),
  };
  const terminal: Terminal = {
    start: (session) => {
      work(session.cwd);
      writeFileSync(session.argv[session.argv.indexOf('--log') + 1] ?? '', 'working\n');
    },
    stop: (name) => {
      stopped.push(name);
    },
    alive: () => true,
  };
  const printed: string[] = [];
  const code = await runRunner({
    name: 'box-1', slots: 1, timeoutMs: 24 * 60 * MIN, version: '0.0.630', checkouts: new Map([['acme/widgets', checkout]]), api, terminal,
    exec, home, wrapper: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'job'], env: { PATH: '/usr/bin' }, githubToken: TOKEN_COMMAND,
    print: (line) => printed.push(line), stop: stop.signal, now: () => clock.now,
    sleep: (ms, signal) => {
      if (signal?.aborted) return Promise.resolve();
      if (ms === 60 * MIN) {
        return new Promise((resolve) => {
          signal?.addEventListener('abort', () => {
            resolve();
          }, { once: true });
        });
      }
      if (ms === 5000) clock.now += ms;
      return new Promise((resolve) => setImmediate(resolve));
    },
    machine: machine(),
    tickMs: 5000,
  });
  const worktree = join(home, 'wt', 'widgets-job-7');
  return { code, home, checkout, worktree, updates, stopped, printed, asked: app.asked };
}

describe('a report refused because the job has ended (PRD 2809, s3)', () => {
  it('stops the job’s session at once, and saves the work its worktree holds before anything is removed', async () => {
    const { code, worktree, checkout, updates, stopped, printed } = await runEnding(2, (cwd) => {
      writeFileSync(join(cwd, 'draft.ts'), 'export const half = 1;\n');
    });
    expect(code).toBe(0);
    // Two running reports taken, the third refused: the session is stopped on that very tick, and on no other.
    expect(updates.filter((update) => update.status === 'running')).toHaveLength(3);
    expect(stopped).toEqual(['job-7']);
    expect(last(updates)).toMatchObject({ status: 'cancelled' });
    // The save ran first: the folder is kept, with its file, and the bundle holds the job's branch.
    expect(readFileSync(join(worktree, 'draft.ts'), 'utf8')).toBe('export const half = 1;\n');
    const { bundle } = savePaths(worktree);
    expect(existsSync(bundle)).toBe(true);
    expect(git(checkout, 'bundle', 'list-heads', bundle)).toContain('refs/heads/omni-checkpoint/agent/job-7');
    expect(printed.some((line) => line.startsWith('job 7 cancelled'))).toBe(true);
  });

  it('removes the folder as before when the session left nothing origin lacks', async () => {
    const { worktree, checkout, stopped, updates } = await runEnding(1, () => undefined);
    expect(stopped).toEqual(['job-7']);
    expect(updates.filter((update) => update.status === 'running')).toHaveLength(2);
    expect(last(updates)).toMatchObject({ status: 'cancelled' });
    expect(existsSync(worktree)).toBe(false);
    expect(existsSync(savePaths(worktree).bundle)).toBe(false);
    expect(git(checkout, 'branch', '--list', 'agent/job-7')).toBe('');
  });

  it('stops it on the first report when the job ended before its session was looked at', async () => {
    const { updates, stopped } = await runEnding(0, () => undefined);
    expect(stopped).toEqual(['job-7']);
    expect(updates.filter((update) => update.status === 'running')).toHaveLength(1);
  });
});

describe('a token refresh refused because the job has ended (PRD 2809, s3)', () => {
  /** Job 7's token file on box-1, its one token expiring `expiresIn` after T0, and a refresh against the ending app. */
  function refreshing(expiresIn: number) {
    const home = mkdtempSync(join(tmpdir(), 'omni-fence-token-'));
    const file = githubTokenFile(home, '7');
    if (file === null) throw new Error('no file');
    saveGithubToken(file, 'box-1', { token: TOKEN, expiresAt: new Date(T0 + expiresIn).toISOString() });
    const app = endingApp(0);
    const clock = { now: T0 };
    const keep = () => keepGithubToken({ file, runner: 'box-1', job: '7', fetchToken: (id) => app.client.githubToken(id), now: () => clock.now, sleep: () => Promise.resolve() });
    return { keep, clock, asked: app.asked };
  }

  it('leaves the replaced attempt only the token it holds, in the app’s words, while that token lives', async () => {
    const { keep, asked } = refreshing(3 * MIN);
    expect(await keep()).toEqual({ token: { token: TOKEN, expiresAt: new Date(T0 + 3 * MIN).toISOString() }, failed: ENDED });
    expect(asked).toEqual(['/api/runners/jobs/7/github-token']);
  });

  it('leaves it no token once that one expired: it loses GitHub within the hour it was minted', async () => {
    const { keep, clock } = refreshing(3 * MIN);
    await keep();
    clock.now = T0 + 3 * MIN;
    expect(await keep()).toEqual({ token: null, failed: `its token expired and no fresh one came (${ENDED})` });
  });
});

/** What the runner sent last. */
function last(updates: JobUpdate[]): JobUpdate | undefined {
  return updates.at(-1);
}
