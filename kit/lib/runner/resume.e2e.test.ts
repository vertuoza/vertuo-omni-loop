// The whole loss, end to end on fakes (PRD 2809, s8): two in-process runners, box-1 and box-3, against one in-memory App
// that queues a resume when a job is lost, holds it until its wait ends, refuses an ended job's report and token refresh,
// and keeps the saves of a chain. The checkouts are real git repositories with a bare origin and a nested worktree; the
// session is a fake that edits files. Nothing here calls GitHub, the app or a model.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import { RunnerRefused } from './api.ts';
import type { CheckpointApi, CheckpointDownload, JobUpdate, RunnerApi, RunnerJob, SaveRecord, Updated } from './api.ts';
import type { CheckpointManifest } from './checkpoint.manifest.ts';
import type { MachineReads } from './health.ts';
import { RESUMABLE_SKILLS } from './line.ts';
import type { Released } from './release.ts';
import type { ResumeClaim } from './resume.claim.ts';
import { runRunner } from './runner.ts';
import type { JobSession } from './terminal.ts';

const GB = 1024 ** 3;
const MINUTE = 60 * 1000;
const T0 = Date.parse('2026-11-13T12:00:00.000Z');
const TOKEN = ['ghs', 'fakeRunnerTokenForTheResumeE2e00001'].join('_');
const GRANT = { token: TOKEN, expiresAt: '2026-11-13T13:00:00Z', login: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' };
/** The wait before the nth attempt's resume: 1 minute after the first loss, 5 after the second. */
const WAITS = [MINUTE, 5 * MINUTE];
const MAX_ATTEMPTS = 3;

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
/** Git for real; anything else answers nothing. */
const exec: ExecText = (file, args, options) => (file === 'git' ? execFileSync(file, args, { ...options, encoding: 'utf8' }) : '');

const MACHINE: MachineReads = {
  cpus: () => [{ times: { user: 1, nice: 0, sys: 0, idle: 9, irq: 0 } }],
  loadavg: () => [0.1, 0.1, 0.1],
  cores: () => 1,
  totalmem: () => 8 * GB,
  freemem: () => 6 * GB,
  meminfo: () => null,
  statfs: () => ({ bsize: 1024, blocks: (100 * GB) / 1024, bavail: (60 * GB) / 1024 }),
};

type Row = {
  id: string;
  line: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  reason: string | null;
  attempt: number;
  resumes: string | null;
  resumeAfter: number;
  runner: string | null;
};
type Save = { job: string; kind: 'portable' | 'local'; path: string | null; manifest: CheckpointManifest };

type Clock = { now: number };

const skillOf = (line: string): string => /^\/omni:([a-z-]+)/.exec(line)?.[1] ?? '';
const ended = (row: Row): boolean => row.status === 'done' || row.status === 'failed';
const endedWords = (row: Row): string => `This job has ended: ${row.status}${row.reason === null ? '' : `, ${row.reason}`}. Stop it.`;

/** The jobs table with its loss rules. */
function jobsTable(clock: Clock) {
  const rows = new Map<string, Row>();
  let counter = 0;

  const enqueue = (line: string, over: Partial<Row> = {}): Row => {
    counter += 1;
    const row: Row = { id: `00000000-0000-4000-8000-00002809${String(counter).padStart(4, '0')}`, line, status: 'queued', reason: null, attempt: 1, resumes: null, resumeAfter: clock.now, runner: null, ...over };
    rows.set(row.id, row);
    return row;
  };

  /** Ends a job `failed · runner lost` and, in the same step, queues its one resume when its skill allows and its attempt is under 3. */
  const lose = (id: string): Row | null => {
    const row = rows.get(id);
    if (row === undefined || ended(row)) return null;
    row.status = 'failed';
    row.reason = 'runner lost';
    const taken = [...rows.values()].some((other) => other.resumes === id);
    if (taken || !RESUMABLE_SKILLS.includes(skillOf(row.line)) || row.attempt >= MAX_ATTEMPTS) return null;
    return enqueue(row.line, { attempt: row.attempt + 1, resumes: id, resumeAfter: clock.now + (WAITS[row.attempt - 1] ?? 0) });
  };

  /** The jobs a row resumes, oldest first. */
  const chainOf = (row: Row): Row[] => {
    const earlier: Row[] = [];
    for (let at = row.resumes === null ? undefined : rows.get(row.resumes); at !== undefined; at = at.resumes === null ? undefined : rows.get(at.resumes)) earlier.unshift(at);
    return earlier;
  };

  return { rows, enqueue, lose, chainOf };
}

/** The bucket and the table of saves, behind the checkpoint calls. */
function savesStore() {
  const saves: Save[] = [];
  const bucket = new Map<string, Uint8Array>();
  const api: CheckpointApi & CheckpointDownload = {
    link: (id, bytes) => Promise.resolve({ path: `ws/${id}/${String(bytes)}.bundle`, url: `https://store.test/ws/${id}/${String(bytes)}.bundle`, expiresAt: '2026-11-13T14:00:00Z' }),
    upload: (link, bundle) => {
      bucket.set(link.path, bundle);
      return Promise.resolve();
    },
    record: (id, save: SaveRecord) => {
      saves.push({ job: id, kind: save.kind, path: save.kind === 'portable' ? save.path : null, manifest: save.manifest });
      return Promise.resolve({ id: `c${String(saves.length)}`, kind: save.kind, keepUntil: '2026-11-20T12:00:00Z' });
    },
    download: (url) => {
      const bytes = bucket.get(url.replace('https://store.test/', ''));
      return bytes === undefined ? Promise.reject(new Error('no such bundle')) : Promise.resolve(bytes);
    },
  };
  return { saves, api };
}

/** What a resume's claim carries: its attempt, its chain and the chain's saves. */
function claimOf(row: Row, chain: Row[], saves: Save[]): ResumeClaim {
  const earlier = new Set(chain.map((link) => link.id));
  return {
    attempt: row.attempt,
    chain: chain.map((link) => link.id),
    saves: saves.filter((save) => earlier.has(save.job)).map((save) => (save.kind === 'portable' ? { job: save.job, kind: 'portable' as const, manifest: save.manifest, url: `https://store.test/${save.path ?? ''}`, expiresAt: null } : { job: save.job, kind: 'local' as const, manifest: save.manifest })),
  };
}

/** The in-memory App: the jobs table with its loss rules, the bucket, and the routes' refusals. */
function memoryApp() {
  const clock: Clock = { now: T0 };
  const { rows, enqueue, lose, chainOf } = jobsTable(clock);
  const { saves, api: checkpoints } = savesStore();
  const handed: { job: string; runner: string; at: number }[] = [];
  const refused: string[] = [];

  /** The first job due, handed to `runner`: a resume carries its chain's saves. */
  const claimFor = (runner: string): RunnerJob | null => {
    const row = [...rows.values()].find((candidate) => candidate.status === 'queued' && candidate.resumeAfter <= clock.now);
    if (row === undefined) return null;
    row.status = 'running';
    row.runner = runner;
    handed.push({ job: row.id, runner, at: clock.now });
    const job: RunnerJob = { id: row.id, line: row.line, repo: 'acme/widgets', sentBy: 'mo', sentByKey: null, github: GRANT, allowedSkills: [] };
    const chain = chainOf(row);
    return chain.length === 0 ? job : { ...job, resume: claimOf(row, chain, saves) };
  };

  /** A report: refused once the job has ended, with the App's words. */
  const report = (runner: string, id: string, update: JobUpdate): Updated => {
    const row = rows.get(id);
    if (row === undefined) return { cancel: true };
    if (ended(row)) {
      refused.push(`${runner} ${id} ${update.status}`);
      return { cancel: true, ended: endedWords(row) };
    }
    if (update.status === 'done' || update.status === 'failed') {
      row.status = update.status;
      row.reason = update.reason ?? null;
    }
    return { cancel: false };
  };

  /** One runner's view of the App; `stop` ends that runner once a job of it sends a last report. */
  const apiFor = (runner: string, stop: AbortController): RunnerApi => ({
    register: () => Promise.resolve({ id: runner }),
    next: () => {
      const job = claimFor(runner);
      if (job !== null) return Promise.resolve(job);
      // Nothing is due: the App holds the call, and the wait runs down.
      clock.now += 30 * 1000;
      return new Promise((resolve) => {
        setImmediate(() => {
          resolve(null);
        });
      });
    },
    update: (id, update) => {
      if (update.status !== 'running') setImmediate(() => { stop.abort(); });
      return Promise.resolve(report(runner, id, update));
    },
    githubToken: (id) => {
      const row = rows.get(id);
      if (row === undefined || !ended(row)) return Promise.resolve({ token: TOKEN, expiresAt: GRANT.expiresAt });
      refused.push(`${runner} ${id} github-token`);
      return Promise.reject(new RunnerRefused(endedWords(row)));
    },
    health: () => Promise.resolve(),
    checkpoints,
  });

  return { clock, rows, saves, handed, refused, enqueue, lose, claimFor, apiFor };
}

/** An origin of `acme/widgets` ignoring `.env`, and one box's checkout of it with its home. */
function boxes() {
  const root = mkdtempSync(join(tmpdir(), 'omni-runner-e2e-'));
  const origin = join(root, 'widgets.git');
  mkdirSync(origin);
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const seed = join(root, 'seed');
  mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'main');
  writeFileSync(join(seed, 'README.md'), 'widgets\n');
  writeFileSync(join(seed, '.gitignore'), '.env\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', origin);
  git(seed, 'push', '-q', '-u', 'origin', 'main');
  const box = (name: string) => {
    mkdirSync(join(root, name));
    const checkout = join(root, name, 'widgets');
    git(root, 'clone', '-q', origin, checkout);
    const home = join(root, name, 'home');
    mkdirSync(home);
    return { name, checkout, home };
  };
  return { box1: box('box-1'), box3: box('box-3') };
}

/** The runner's sleep on the fake clock: an hour's wait (the sweep's) runs until the runner stops, any other moves the clock. */
const sleepOn = (app: ReturnType<typeof memoryApp>) => (ms: number, signal?: AbortSignal): Promise<void> => new Promise((resolve) => {
  if (signal?.aborted === true) {
    resolve();
  } else if (ms === 60 * MINUTE) {
    signal?.addEventListener('abort', () => {
      resolve();
    }, { once: true });
  } else {
    app.clock.now += ms;
    setImmediate(resolve);
  }
});

/** Runs one box on `app` until a job of it sends its last report; `session` is what its fake session does once started. */
async function runBox(app: ReturnType<typeof memoryApp>, box: { name: string; checkout: string; home: string }, session: (started: JobSession) => void): Promise<string[]> {
  const stop = new AbortController();
  const printed: string[] = [];
  await runRunner({
    name: box.name, slots: 1, timeoutMs: 60 * 60 * 1000, version: '0.0.631', checkouts: new Map([['acme/widgets', box.checkout]]), api: app.apiFor(box.name, stop),
    terminal: { start: session, stop: () => undefined, alive: () => true },
    exec, home: box.home, wrapper: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'job'], env: { PATH: '/usr/bin' },
    print: (line) => printed.push(line), stop: stop.signal, now: () => app.clock.now, sleep: sleepOn(app),
    machine: MACHINE, githubToken: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'],
    release: (): Released => ({ released: [], releaseError: null }),
  });
  return printed;
}

const argOf = (started: JobSession, flag: string): string => started.argv[started.argv.indexOf(flag) + 1] ?? '';

/** What box-3's session finds once it has taken the checkpoint into its own slice worktree. */
type Found = { slice: string; more: string; env: boolean; note: string; line: string };

/** Box-1's session: a slice with one commit never pushed, one file never committed and a .env git ignores. */
function buildsSlice(started: JobSession): void {
  const slice = join(started.cwd, '.claude', 'worktrees', 's3');
  git(started.cwd, 'worktree', 'add', '-q', '--no-track', '-b', 'feat/x--s3', slice, 'origin/main');
  writeFileSync(join(slice, 'slice.ts'), 'export const one = 1;\n');
  git(slice, 'add', '-A');
  git(slice, 'commit', '-q', '-m', 'slice: one');
  writeFileSync(join(slice, 'more.ts'), 'export const more = true;\n');
  writeFileSync(join(slice, '.env'), 'SECRET=never-travels\n');
}

/** Box-3's session: takes the checkpoint as its resume note says, reads what the worktree holds, and ends. */
function takesCheckpoint(started: JobSession): Found {
  const slice = join(started.cwd, '.claude', 'worktrees', 's3');
  git(started.cwd, 'worktree', 'add', '-q', '--no-track', '-b', 'feat/x--s3', slice, 'origin/main');
  git(slice, 'merge', '--ff-only', 'omni-checkpoint/feat/x--s3');
  const line = readFileSync(argOf(started, '--line'), 'utf8');
  const notePath = /read (\S+\.resume\.md)/.exec(line)?.[1] ?? '';
  writeFileSync(argOf(started, '--exit'), '0\n');
  return {
    slice: readFileSync(join(slice, 'slice.ts'), 'utf8'),
    more: readFileSync(join(slice, 'more.ts'), 'utf8'),
    env: existsSync(join(slice, '.env')),
    note: existsSync(notePath) ? readFileSync(notePath, 'utf8') : '',
    line,
  };
}

/** A row the App queued, or a failed test. */
function must(row: Row | null): Row {
  if (row === null) throw new Error('no resume was queued');
  return row;
}

describe('a runner lost mid-slice (PRD 2809, s8)', () => {
  it('box-1 is lost with work unpushed, box-3 resumes from its save after the wait, box-1 is refused', async () => {
    const { box1, box3 } = boxes();
    const app = memoryApp();
    const first = app.enqueue('/omni:wave 2809');
    let lostAt = 0;

    // The App stops hearing from box-1 once its slice is built: its job is lost, and its resume queued in the same step.
    const printed1 = await runBox(app, box1, (started) => {
      buildsSlice(started);
      lostAt = app.clock.now;
      app.lose(first.id);
    });

    // Box-1's late report was refused, its work went to the App's bucket, and its token refresh is refused too.
    expect(app.refused.some((line) => line.startsWith(`box-1 ${first.id}`) && !line.endsWith('github-token'))).toBe(true);
    expect(printed1).toContain(`job ${first.id}: its save went to the app`);
    expect(app.saves).toHaveLength(1);
    expect(app.saves[0]).toMatchObject({ job: first.id, kind: 'portable', manifest: { runner: 'box-1', branches: [expect.objectContaining({ branch: 'feat/x--s3', files: 1, commits: 1 })] } });
    await expect(app.apiFor('box-1', new AbortController()).githubToken(first.id)).rejects.toThrow(/has ended: failed, runner lost/);
    expect(app.refused.at(-1)).toBe(`box-1 ${first.id} github-token`);

    // The resume is one row, one attempt more, a minute after the loss; marking the job lost again queues nothing.
    const resumes = [...app.rows.values()].filter((row) => row.resumes === first.id);
    expect(resumes).toHaveLength(1);
    const resumeId = resumes[0]?.id ?? '';
    expect(resumes[0]).toMatchObject({ attempt: 2, resumeAfter: lostAt + MINUTE, status: 'queued' });
    expect(app.lose(first.id)).toBeNull();
    expect([...app.rows.values()].filter((row) => row.resumes === first.id)).toHaveLength(1);

    // Before its wait ends no runner is handed it.
    app.clock.now = lostAt + MINUTE / 2;
    expect(app.claimFor('box-3')).toBeNull();

    // Box-3 claims it once the wait ends, and finds the unpushed commit and the uncommitted file in its own worktree.
    const found: Found[] = [];
    const printed3 = await runBox(app, box3, (started) => {
      found.push(takesCheckpoint(started));
    });
    expect(app.handed.filter((claim) => claim.job === resumeId)).toEqual([{ job: resumeId, runner: 'box-3', at: expect.any(Number) as number }]);
    expect(app.handed.find((claim) => claim.job === resumeId)?.at).toBeGreaterThanOrEqual(lostAt + MINUTE);
    expect(found).toEqual([{
      slice: 'export const one = 1;\n',
      more: 'export const more = true;\n',
      env: false,
      note: expect.stringContaining('`feat/x--s3` as `omni-checkpoint/feat/x--s3`') as string,
      line: expect.stringContaining('attempt 2 of 3') as string,
    }]);
    expect(printed3).toContain(`job ${resumeId}: attempt 2 of 3, 1 branch came back`);
    expect(app.rows.get(resumeId)?.status).toBe('done');
  });

  it('a third loss stops the chain and queues no fourth attempt', () => {
    const app = memoryApp();
    const first = app.enqueue('/omni:yolo 2809');
    const second = must(app.lose(first.id));
    expect(second).toMatchObject({ attempt: 2, resumeAfter: app.clock.now + MINUTE });

    // Held back for a minute, then handed, and lost again: the third attempt waits five.
    expect(app.claimFor('box-3')).toBeNull();
    app.clock.now += MINUTE;
    expect(app.claimFor('box-3')?.resume?.attempt).toBe(2);
    const third = must(app.lose(second.id));
    expect(third).toMatchObject({ attempt: 3, resumeAfter: app.clock.now + 5 * MINUTE });
    app.clock.now += 5 * MINUTE;
    expect(app.claimFor('box-3')?.resume).toMatchObject({ attempt: 3, chain: [first.id, second.id] });

    // The third loss queues nothing: the chain stops, and a second mark of it queues nothing either.
    expect(app.lose(third.id)).toBeNull();
    expect(app.lose(third.id)).toBeNull();
    expect([...app.rows.values()].filter((row) => row.status === 'queued')).toEqual([]);
    expect(app.rows.size).toBe(3);
  });


  it('a job of a skill that never resumes queues none', () => {
    const app = memoryApp();
    const job = app.enqueue('/omni:pitch 2809');
    expect(app.lose(job.id)).toBeNull();
    expect(app.rows.size).toBe(1);
  });
});
