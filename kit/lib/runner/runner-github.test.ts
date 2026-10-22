// A runner's job as an API key's GitHub App (PRD 2433, s2): `runRunner()` on a fake app and a fake terminal,
// one job each. The job's session starts as the app, with the token only in a file the session reads through
// `omni runner github-token`; nothing the runner sends holds the token, current or past; a job with no app
// starts with the environment it always had. No test holds a real token.
//
// Kept current (s3): a token with less than 5 minutes left is asked for again, on a fake clock; a refusal is
// tried again every minute; a token that expired with no fresh one ends the job `failed`, `github app: <why>`;
// the claims of a job that ran as an app are released with its token, never the machine's.
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RunnerRefused } from './api.ts';
import type { JobUpdate, Registration, RunnerApi, RunnerJob } from './api.ts';
import { ghShimDir } from './github-app.ts';
import { githubTokenFile, saveGithubToken } from './github-token.ts';
import type { GithubToken } from './github-token.ts';
import type { EndedJob } from './release.ts';
import { runRunner } from './runner.ts';
import type { RunnerOptions } from './runner.ts';
import type { JobSession, Terminal } from './terminal.ts';

const GB = 1024 ** 3;
const T0 = Date.parse('2026-10-22T12:00:00.000Z');
const TOKEN = ['ghs', 'fakeRunnerTokenForTheJob0123456789ABC'].join('_');
const PAST = ['ghs', 'fakePastTokenOfTheSameJob9876543210XYZ'].join('_');
const GRANT = { token: TOKEN, expiresAt: '2026-10-22T13:00:00Z', login: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' };
const TOKEN_COMMAND = ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'];
/** How often the runner looks at a running job. */
const TICK_MS = 5000;

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

/** What the fake app answers when the runner asks for a fresh token: a token, or the refusal it says (an `Error`). */
type Fresh = GithubToken | Error;

/** A wait that ends only when `signal` aborts. */
function untilAborted(signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    signal?.addEventListener('abort', () => {
      resolve();
    }, { once: true });
  });
}

/**
 * Runs the one job `given` on a fake app until its last report. The session the fake terminal "starts" writes
 * `log`, then its exit code, and reports what its token file held at that moment.
 */
async function runOne(
  given: RunnerJob,
  over: Partial<RunnerOptions> & {
    log?: string;
    during?: (home: string, session: JobSession) => void;
    home?: string;
    /** The app's answers to the runner asking for a fresh token, in turn; asking more often than that is a refusal. */
    fresh?: Fresh[];
    /** How long, on the fake clock, the session runs before it exits 0: it exits at once unless given. */
    exitAfter?: number;
    /** A line the session writes to its log once that long has passed on the fake clock. */
    append?: { after: number; text: string };
  } = {},
) {
  const { log = '', during, fresh = [], exitAfter, append, ...options } = over;
  const home = options.home ?? mkdtempSync(join(tmpdir(), 'omni-runner-github-'));
  const registered: Registration[] = [];
  const updates: JobUpdate[] = [];
  const seen: Seen[] = [];
  const clock = { now: T0 };
  const stop = new AbortController();
  const asked: { job: string; at: number }[] = [];
  const stopped: string[] = [];
  let exitFile: string | null = null;
  let logFile: string | null = null;
  let appended = false;
  let handed = false;
  /** What the running session does as the fake clock moves: writes its log line, then exits. */
  const sessionMoves = (): void => {
    const elapsed = clock.now - T0;
    if (logFile !== null && append !== undefined && !appended && elapsed >= append.after) {
      appended = true;
      appendFileSync(logFile, `${append.text}\n`);
    }
    if (exitFile !== null && exitAfter !== undefined && elapsed >= exitAfter) writeFileSync(exitFile, '0\n');
  };
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
    githubToken: (job) => {
      asked.push({ job, at: clock.now });
      const next = fresh.shift();
      if (next === undefined) return Promise.reject(new RunnerRefused('refused (no answer was queued)'));
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    health: () => Promise.resolve(),
  };
  const flag = (session: JobSession, name: string): string => session.argv[session.argv.indexOf(name) + 1] ?? '';
  const terminal: Terminal = {
    start: (session) => {
      const file = githubTokenFile(home, given.id);
      seen.push({ session, tokenFile: file !== null && existsSync(file) ? readFileSync(file, 'utf8') : null });
      during?.(home, session);
      logFile = flag(session, '--log');
      writeFileSync(logFile, log);
      if (exitAfter === undefined) writeFileSync(flag(session, '--exit'), '0\n');
      else exitFile = flag(session, '--exit');
    },
    stop: (name) => {
      stopped.push(name);
    },
    alive: () => true,
  };
  const printed: string[] = [];
  const code = await runRunner({
    // A session that runs on for minutes is given a day, as a job is.
    name: 'box-1', slots: 1, timeoutMs: exitAfter === undefined ? 60_000 : 24 * 60 * 60_000, version: '0.0.526', checkouts: new Map([['acme/widgets', join(home, 'widgets')]]), api, terminal,
    exec: () => '', home, wrapper: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'job'], env: { PATH: '/usr/bin' },
    print: (line) => printed.push(line), stop: stop.signal, now: () => clock.now,
    sleep: (ms, signal) => {
      if (signal?.aborted) return Promise.resolve();
      if (ms === 60 * 60 * 1000) return untilAborted(signal);
      // Only the look at the running job (every 5 s) moves the clock, so every other wait of the runner, the
      // health report's among them, leaves the minutes of a session to the ticks that count them.
      if (ms === TICK_MS) clock.now += ms;
      sessionMoves();
      return new Promise((resolve) => setImmediate(resolve));
    },
    machine: machine(),
    tickMs: TICK_MS,
    ...options,
  });
  return { code, home, registered, updates, seen, printed, asked, stopped, clock };
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

const SECOND = ['ghs', 'fakeSecondTokenOfTheSameJob5555555555ZZ'].join('_');
const MIN = 60_000;
const expiry = (ms: number): string => new Date(T0 + ms).toISOString();
/** A job whose app token expires `expiresIn` after the job is handed over. */
const asApp = (expiresIn: number): RunnerJob => job({ sentBy: 'ada', github: { ...GRANT, expiresAt: expiry(expiresIn) } });
const fresh = (token: string, expiresIn: number): GithubToken => ({ token, expiresAt: expiry(expiresIn) });
/** The app turning the runner down `times` times, in its own words. */
const refused = (times: number, why = 'refused (503)'): Error[] => Array.from({ length: times }, () => new RunnerRefused(why));
/** What the runner sent last, whatever it was. */
const last = (updates: JobUpdate[]): JobUpdate | undefined => updates.at(-1);

describe('keeping the token current (PRD 2433, s3)', () => {
  it('does not ask while the token has 5 minutes or more left', async () => {
    const { asked, updates, code } = await runOne(asApp(60 * MIN), { githubToken: TOKEN_COMMAND, exitAfter: 30 * MIN });
    expect(code).toBe(0);
    expect(asked).toEqual([]);
    expect(last(updates)).toMatchObject({ status: 'done' });
  });

  it('asks the app for a fresh token the first time the current one has less than 5 minutes left, and keeps it beside the old one', async () => {
    const { asked, updates, printed } = await runOne(asApp(10 * MIN), {
      githubToken: TOKEN_COMMAND,
      exitAfter: 8 * MIN,
      fresh: [fresh(SECOND, 70 * MIN)],
      // Written once the fresh token is kept: the old token and the fresh one are both masked.
      append: { after: 7 * MIN, text: `remote: https://x-access-token:${SECOND}@github.com/acme/widgets.git\nthe old one ${TOKEN}` },
    });
    // The tick after 5 minutes left is the first to see less.
    expect(asked).toEqual([{ job: '7', at: T0 + 5 * MIN + 5000 }]);
    expect(last(updates)).toMatchObject({ status: 'done' });
    const lines = updates.flatMap((update) => update.lines ?? []);
    expect(lines).toContain('remote: https://x-access-token:***@github.com/acme/widgets.git');
    expect(lines).toContain('the old one ***');
    expect(JSON.stringify([updates, printed])).not.toContain(SECOND);
    expect(JSON.stringify([updates, printed])).not.toContain(TOKEN);
  });

  it('asks again every minute while the app refuses, and the job runs on until a fresh token comes', async () => {
    const { asked, updates, stopped } = await runOne(asApp(10 * MIN), {
      githubToken: TOKEN_COMMAND,
      exitAfter: 9 * MIN,
      fresh: [...refused(2), fresh(SECOND, 70 * MIN)],
    });
    expect(asked.map((ask) => ask.at - T0)).toEqual([5 * MIN + 5000, 6 * MIN + 5000, 7 * MIN + 5000]);
    expect(last(updates)).toMatchObject({ status: 'done' });
    expect(stopped).toEqual([]);
  });

  it('ends the job failed, github app: <why>, once its token expired with no fresh one, and stops its session', async () => {
    const { asked, updates, stopped, home, printed } = await runOne(asApp(10 * MIN), {
      githubToken: TOKEN_COMMAND,
      exitAfter: 60 * MIN,
      fresh: refused(30, 'This job ended more than 10 minutes ago.'),
    });
    // Every minute from the first tick under 5 minutes, up to the minute the token runs out.
    expect(asked.map((ask) => ask.at - T0)).toEqual([5 * MIN + 5000, 6 * MIN + 5000, 7 * MIN + 5000, 8 * MIN + 5000, 9 * MIN + 5000]);
    expect(last(updates)).toMatchObject({ status: 'failed', reason: 'github app: its token expired and no fresh one came (This job ended more than 10 minutes ago.)' });
    expect(stopped).toHaveLength(1);
    expect(printed.some((line) => line.startsWith('job 7 failed · github app: '))).toBe(true);
    const file = githubTokenFile(home, '7');
    expect(file === null || existsSync(file)).toBe(false);
    expect(JSON.stringify([updates, printed])).not.toContain(TOKEN);
  });

  it('never carries a token the app echoes in its refusal, in the reason, the reports or the lines the runner prints', async () => {
    const { updates, printed } = await runOne(asApp(10 * MIN), { githubToken: TOKEN_COMMAND, exitAfter: 60 * MIN, fresh: refused(30, `bad credentials for ${TOKEN}`) });
    expect(last(updates)).toMatchObject({ status: 'failed', reason: 'github app: its token expired and no fresh one came (bad credentials for ***)' });
    expect(JSON.stringify([updates, printed])).not.toContain(TOKEN);
  });

  it('keeps nothing and asks nothing for a job with no app', async () => {
    const { asked, updates, home } = await runOne(job(), { githubToken: TOKEN_COMMAND, exitAfter: 30 * MIN, fresh: refused(30) });
    expect(asked).toEqual([]);
    expect(last(updates)).toMatchObject({ status: 'done' });
    expect(existsSync(ghShimDir(home))).toBe(false);
  });

  it('keeps the Omni page to ask in the job’s file when the runner knows it, for the session’s own refresh', async () => {
    const { seen } = await runOne(asApp(60 * MIN), { githubToken: TOKEN_COMMAND, askUrl: 'https://omni.example/app' });
    expect(JSON.parse(seen[0]?.tokenFile ?? 'null')).toEqual({
      runner: 'box-1',
      page: 'https://omni.example/app',
      tokens: [{ token: TOKEN, expiresAt: expiry(60 * MIN) }],
    });
  });
});

describe('releasing the claims of a job as the app (PRD 2433, s3)', () => {
  /** A releaser that keeps what it was asked and releases PR 3. */
  const releaser = () => {
    const ended: EndedJob[] = [];
    return {
      ended,
      release: (asked: EndedJob) => {
        ended.push(asked);
        return { released: [3], releaseError: null };
      },
    };
  };

  it('runs the release with the job’s token when the job had an app', async () => {
    const { ended, release } = releaser();
    const { updates, printed } = await runOne(asApp(60 * MIN), { githubToken: TOKEN_COMMAND, release });
    expect(ended).toEqual([{ id: '7', runner: 'box-1', repo: 'acme/widgets', reason: 'done', ghToken: TOKEN }]);
    expect(last(updates)).toMatchObject({ status: 'done', released: [3], releaseError: null });
    expect(printed).toContain('job 7 released #3');
  });

  it('runs it as the machine does when the job had none: no token, as always', async () => {
    const { ended, release } = releaser();
    await runOne(job(), { githubToken: TOKEN_COMMAND, release });
    expect(ended).toEqual([{ id: '7', runner: 'box-1', repo: 'acme/widgets', reason: 'done', ghToken: null }]);
  });

  it('runs it with a fresh token when the job ended with less than 5 minutes left', async () => {
    const { ended, release } = releaser();
    const { asked } = await runOne(asApp(3 * MIN), { githubToken: TOKEN_COMMAND, release, fresh: [fresh(SECOND, 63 * MIN)] });
    expect(asked).toHaveLength(1);
    expect(ended.map((entry) => entry.ghToken)).toEqual([SECOND]);
  });

  it('runs it with the token the job still holds when no fresh one comes, while it has not expired', async () => {
    const { ended, release } = releaser();
    const { asked } = await runOne(asApp(3 * MIN), { githubToken: TOKEN_COMMAND, release, fresh: refused(1) });
    expect(asked).toHaveLength(1);
    expect(ended.map((entry) => entry.ghToken)).toEqual([TOKEN]);
  });

  it('releases nothing, and says why, when the job ran as an app and has no token now: never as the machine', async () => {
    const { ended, release } = releaser();
    const { updates, printed } = await runOne(asApp(-MIN), { githubToken: TOKEN_COMMAND, release, fresh: refused(1, 'This job ended more than 10 minutes ago.') });
    expect(ended).toEqual([]);
    expect(last(updates)).toMatchObject({
      status: 'done',
      released: [],
      releaseError: 'github app: its token expired and no fresh one came (This job ended more than 10 minutes ago.)',
    });
    expect(printed.some((line) => line.includes('could not release its claims: github app: its token expired'))).toBe(true);
  });

  it('hides the job’s tokens in the lines the release prints', async () => {
    const release = (): { released: number[]; releaseError: string | null } => ({ released: [], releaseError: `gh said no to ${TOKEN}` });
    const { updates, printed } = await runOne(asApp(60 * MIN), { githubToken: TOKEN_COMMAND, release });
    expect(printed.some((line) => line.includes('could not release its claims: gh said no to ***'))).toBe(true);
    expect(JSON.stringify(printed)).not.toContain(TOKEN);
    expect(last(updates)).toMatchObject({ released: [], releaseError: 'gh said no to ***' });
  });
});
