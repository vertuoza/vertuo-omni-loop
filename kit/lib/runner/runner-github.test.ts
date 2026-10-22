// A runner's job as an API key's GitHub App (PRD 2433, s2): `runRunner()` on a fake app and a fake terminal,
// one job each. The job's session starts as the app, with the token only in a file the session reads through
// `omni runner github-token`; nothing the runner sends holds the token, current or past; a job with no app
// starts with the environment it always had. No test holds a real token.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { JobUpdate, Registration, RunnerApi, RunnerJob } from './api.ts';
import { ghShimDir } from './github-app.ts';
import { githubTokenFile, saveGithubToken } from './github-token.ts';
import { runRunner } from './runner.ts';
import type { RunnerOptions } from './runner.ts';
import type { JobSession, Terminal } from './terminal.ts';

const GB = 1024 ** 3;
const T0 = Date.parse('2026-10-22T12:00:00.000Z');
const TOKEN = ['ghs', 'fakeRunnerTokenForTheJob0123456789ABC'].join('_');
const PAST = ['ghs', 'fakePastTokenOfTheSameJob9876543210XYZ'].join('_');
const GRANT = { token: TOKEN, expiresAt: '2026-10-22T13:00:00Z', login: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' };
const TOKEN_COMMAND = ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'];

const job = (over: Partial<RunnerJob> = {}): RunnerJob => ({ id: '7', line: '/omni:yolo 7', repo: 'acme/widgets', sentBy: null, sentByKey: null, github: null, allowedSkills: [], ...over });

/** A machine that is never under pressure. */
const machine = () => {
  let samples = 0;
  return {
    cpus: () => {
      samples += 1;
      const times = { user: 300 * samples, nice: 0, sys: 0, idle: 700 * samples, irq: 0 };
      return [{ times }, { times }];
    },
    loadavg: (): [number, number, number] => [0.1, 0.1, 0.1],
    cores: () => 2,
    totalmem: () => 8 * GB,
    freemem: () => 6 * GB,
    meminfo: () => null,
    statfs: () => ({ bsize: 1024, blocks: (100 * GB) / 1024, bavail: (80 * GB) / 1024 }),
  };
};

type Seen = { session: JobSession; tokenFile: string | null };

/**
 * Runs the one job `given` on a fake app until its last report. The session the fake terminal "starts" writes
 * `log`, then its exit code, and reports what its token file held at that moment.
 */
async function runOne(given: RunnerJob, over: Partial<RunnerOptions> & { log?: string; during?: (home: string, session: JobSession) => void; home?: string } = {}) {
  const { log = '', during, ...options } = over;
  const home = options.home ?? mkdtempSync(join(tmpdir(), 'omni-runner-github-'));
  const registered: Registration[] = [];
  const updates: JobUpdate[] = [];
  const seen: Seen[] = [];
  const clock = { now: T0 };
  const stop = new AbortController();
  let handed = false;
  const api: RunnerApi = {
    register: (registration) => {
      registered.push(registration);
      return Promise.resolve({ id: 'r1' });
    },
    next: (_runner, signal) => {
      if (!handed) {
        handed = true;
        return Promise.resolve(given);
      }
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve(null);
        }, { once: true });
      });
    },
    update: (_job, update) => {
      updates.push(update);
      if (update.status !== 'running') stop.abort();
      return Promise.resolve({ cancel: false });
    },
    health: () => Promise.resolve(),
  };
  const flag = (session: JobSession, name: string): string => session.argv[session.argv.indexOf(name) + 1] ?? '';
  const terminal: Terminal = {
    start: (session) => {
      const file = githubTokenFile(home, given.id);
      seen.push({ session, tokenFile: file !== null && existsSync(file) ? readFileSync(file, 'utf8') : null });
      during?.(home, session);
      writeFileSync(flag(session, '--log'), log);
      writeFileSync(flag(session, '--exit'), '0\n');
    },
    stop: () => undefined,
    alive: () => true,
  };
  const printed: string[] = [];
  const code = await runRunner({
    name: 'box-1', slots: 1, timeoutMs: 60_000, version: '0.0.526', checkouts: new Map([['acme/widgets', join(home, 'widgets')]]), api, terminal,
    exec: () => '', home, wrapper: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'job'], env: { PATH: '/usr/bin' },
    print: (line) => printed.push(line), stop: stop.signal, now: () => clock.now,
    sleep: (ms, signal) => new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      if (ms === 60 * 60 * 1000) {
        signal?.addEventListener('abort', () => {
          resolve();
        }, { once: true });
        return;
      }
      clock.now += ms;
      setImmediate(resolve);
    }),
    machine: machine(),
    ...options,
  });
  return { code, home, registered, updates, seen, printed };
}

describe('registering', () => {
  it('says it can run a job as an app when it was given the command that reads the job’s token', async () => {
    const { registered } = await runOne(job(), { githubToken: TOKEN_COMMAND });
    expect(registered).toEqual([{ name: 'box-1', slots: 1, repos: ['acme/widgets'], version: '0.0.526', githubApp: true }]);
  });

  it('says it cannot when it was not', async () => {
    const { registered } = await runOne(job());
    expect(registered[0]?.githubApp).toBe(false);
  });
});

describe('a job with an app (the claim’s github)', () => {
  const asApp = job({ sentBy: 'ada', github: GRANT });

  it('starts as the app: its identity, git over HTTPS, and the gh first on PATH, none of them holding the token', async () => {
    const { seen, home } = await runOne(asApp, { githubToken: TOKEN_COMMAND });
    const env = seen[0]?.session.env;
    expect(env).toMatchObject({
      OMNI_JOB: '7',
      OMNI_RUNNER: 'box-1',
      OMNI_UNATTENDED: '1',
      OMNI_SENT_BY: 'ada',
      OMNI_GITHUB_APP: 'omni-acme[bot]',
      GIT_AUTHOR_NAME: 'omni-acme[bot]',
      GIT_AUTHOR_EMAIL: '42+omni-acme[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'omni-acme[bot]',
      GIT_COMMITTER_EMAIL: '42+omni-acme[bot]@users.noreply.github.com',
      GIT_CONFIG_COUNT: '4',
      PATH: `${ghShimDir(home)}:/usr/bin`,
    });
    expect(env?.GIT_CONFIG_VALUE_1).toBe("!'/usr/bin/node' '/opt/omni.mjs' 'runner' 'github-token' '--git'");
    expect(JSON.stringify(seen[0]?.session)).not.toContain(TOKEN);
    expect(statSync(join(ghShimDir(home), 'gh')).mode & 0o111).not.toBe(0);
  });

  it('keeps the token in a file of its own, for the runner only, before the session starts, and forgets it once the job is reported', async () => {
    const { seen, home } = await runOne(asApp, { githubToken: TOKEN_COMMAND });
    const file = githubTokenFile(home, '7');
    expect(JSON.parse(seen[0]?.tokenFile ?? 'null')).toEqual({ runner: 'box-1', tokens: [{ token: GRANT.token, expiresAt: GRANT.expiresAt }] });
    expect(file === null || existsSync(file)).toBe(false);
  });

  it('never carries the token in anything it sends: the log’s lines, its tail, the pull request, the reason', async () => {
    const log = [
      'starting',
      `remote: https://x-access-token:${TOKEN}@github.com/acme/widgets.git`,
      `PR: https://github.com/acme/widgets/pull/42?t=${TOKEN}`,
      `an older token ${PAST}`,
      `the last line, still being written ${TOKEN.slice(0, 15)}`,
    ].join('\n');
    const { updates, code } = await runOne(asApp, {
      githubToken: TOKEN_COMMAND,
      log,
      // A token the session had before, kept the way a refresh will keep it.
      during: (home) => {
        const file = githubTokenFile(home, '7');
        if (file !== null) saveGithubToken(file, 'box-1', { token: PAST, expiresAt: '2026-10-22T12:30:00Z' });
      },
    });
    expect(code).toBe(0);
    const sent = JSON.stringify(updates);
    expect(sent).not.toContain(TOKEN);
    expect(sent).not.toContain(PAST);
    expect(sent).not.toContain(TOKEN.slice(0, 15));
    expect(updates.flatMap((update) => update.lines ?? [])).toEqual([
      'starting',
      'remote: https://x-access-token:***@github.com/acme/widgets.git',
      'PR: https://github.com/acme/widgets/pull/42?t=***',
      'an older token ***',
      'the last line, still being written ***',
    ]);
  });

  it('fails the job with the reason, before any session, when the runner has no command to read the token', async () => {
    const { seen, updates, home } = await runOne(asApp);
    expect(seen).toEqual([]);
    expect(updates).toEqual([{ status: 'failed', reason: 'github app: this runner cannot give the job its token' }]);
    const file = githubTokenFile(home, '7');
    expect(file === null || existsSync(file)).toBe(false);
  });

  it('fails the job with the reason, before any session, when the token cannot be kept', async () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-runner-github-'));
    // `logs` is a file: nothing can be kept under it.
    writeFileSync(join(home, 'logs'), 'in the way');
    const { seen, updates, printed } = await runOne(asApp, { githubToken: TOKEN_COMMAND, home });
    expect(seen).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'failed' });
    expect(updates[0]?.reason).toMatch(/^github app: /);
    expect(JSON.stringify([updates, printed])).not.toContain(TOKEN);
  });

  it('starts a job’s token file again when another runner left one', async () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-runner-github-'));
    const file = githubTokenFile(home, '7');
    if (file === null) throw new Error('no file');
    saveGithubToken(file, 'box-2', { token: PAST, expiresAt: '2026-10-22T12:30:00Z' });
    const { seen } = await runOne(asApp, { githubToken: TOKEN_COMMAND, home });
    expect(JSON.parse(seen[0]?.tokenFile ?? 'null')).toEqual({ runner: 'box-1', tokens: [{ token: GRANT.token, expiresAt: GRANT.expiresAt }] });
  });
});

describe('a job with no app', () => {
  it('starts with the environment it always had, byte for byte, and makes no shim', async () => {
    const { seen, home } = await runOne(job(), { githubToken: TOKEN_COMMAND });
    expect(seen[0]?.session.env).toEqual({
      PATH: '/usr/bin',
      OMNI_JOB: '7',
      OMNI_RUNNER: 'box-1',
      OMNI_UNATTENDED: '1',
      CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0',
    });
    expect(existsSync(ghShimDir(home))).toBe(false);
  });

  it('names its sender as it always did', async () => {
    const { seen } = await runOne(job({ sentBy: 'ada' }), { githubToken: TOKEN_COMMAND });
    expect(seen[0]?.session.env).toMatchObject({ OMNI_SENT_BY: 'ada', OMNI_RUNNER: 'box-1' });
    expect(seen[0]?.session.env).not.toHaveProperty('OMNI_SENT_BY_KEY');
    expect(seen[0]?.session.env).not.toHaveProperty('OMNI_GITHUB_APP');
  });

  it('sends its log as it is: it holds no token to hide', async () => {
    const stranger = ['ghs', 'notATokenOfAnyJob0123456789'].join('_');
    const { updates } = await runOne(job(), { githubToken: TOKEN_COMMAND, log: `${stranger}\nok` });
    expect(updates.flatMap((update) => update.lines ?? [])).toEqual([stranger, 'ok']);
  });
});

describe('a job an API key sent', () => {
  it('names the key, never the person whose login the claim may carry', async () => {
    const { seen } = await runOne(job({ sentBy: 'ada', sentByKey: 'deploy bot' }), { githubToken: TOKEN_COMMAND });
    const env = seen[0]?.session.env;
    expect(env).toMatchObject({ OMNI_SENT_BY_KEY: 'deploy bot', OMNI_RUNNER: 'box-1' });
    expect(env).not.toHaveProperty('OMNI_SENT_BY');
  });

  it('runs as its app too, when the claim carries one', async () => {
    const { seen } = await runOne(job({ sentByKey: 'deploy bot', github: GRANT }), { githubToken: TOKEN_COMMAND });
    expect(seen[0]?.session.env).toMatchObject({ OMNI_SENT_BY_KEY: 'deploy bot', OMNI_GITHUB_APP: 'omni-acme[bot]' });
  });
});

describe('the shim', () => {
  it('leaves the shim in place between jobs: it holds no token and the next job reads the same file', async () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-runner-github-'));
    mkdirSync(join(home, 'logs'), { recursive: true });
    await runOne(job({ github: GRANT }), { githubToken: TOKEN_COMMAND, home });
    expect(existsSync(join(ghShimDir(home), 'gh'))).toBe(true);
    expect(readFileSync(join(ghShimDir(home), 'gh'), 'utf8')).not.toContain(TOKEN);
  });
});
