// The runner around a resume (PRD 2809, s5): `runRunner()` on a fake app, a fake clock and a fake session, over a real
// checkout with its own bare origin. A resume's saves come back in the checkout as `omni-checkpoint/<branch>` and its
// session's prompt points at the note; a job's save leaves through the app's checkpoint calls; a job the app refused a
// report of as lost leaves its claims to its chain, and a job of a chain releases the claims of its earlier jobs. Nothing
// here calls GitHub, the app or Claude.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import type { CheckpointApi, CheckpointDownload, JobUpdate, RunnerApi, RunnerJob, SaveRecord, Updated } from './api.ts';
import { saveJob } from './checkpoint.ts';
import { CheckpointManifestSchema } from './checkpoint.manifest.ts';
import type { MachineReads } from './health.ts';
import type { EndedJob, Released } from './release.ts';
import type { ResumeClaim } from './resume.claim.ts';
import { readChain } from './resume.ts';
import { runRunner } from './runner.ts';
import type { JobSession } from './terminal.ts';

const GB = 1024 ** 3;
const T0 = Date.parse('2026-11-13T12:00:00.000Z');
const TOKEN = ['ghs', 'fakeRunnerTokenForTheResumeTests012'].join('_');
const GRANT = { token: TOKEN, expiresAt: '2026-11-13T13:00:00Z', login: 'omni-acme[bot]', email: '42+omni-acme[bot]@users.noreply.github.com' };
const LOST = '00000000-0000-4000-8000-000028095001';
const SECOND = '00000000-0000-4000-8000-000028095002';
const JOB = '00000000-0000-4000-8000-000028095003';
const LOST_WORDS = 'This job has ended: failed, runner lost. Stop it.';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
/** Git for real; anything else (the `claude` the plugin's care asks) answers nothing. */
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

/** An origin of `acme/widgets` ignoring `.env`, and box-3's checkout of it, with box-3's home. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'omni-runner-resume-'));
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
  const checkout = join(root, 'box-3', 'widgets');
  mkdirSync(join(root, 'box-3'));
  git(root, 'clone', '-q', origin, checkout);
  const home = join(root, 'box-3', 'home');
  mkdirSync(home);
  return { root, origin, checkout, home };
}

/** Box-1's save of the lost job: a slice's worktree with a commit never pushed and an uncommitted file. Its bundle's bytes and manifest. */
function box1Save(root: string, origin: string) {
  const box1 = join(root, 'box-1', 'widgets');
  mkdirSync(join(root, 'box-1'));
  git(root, 'clone', '-q', origin, box1);
  const folder = join(root, 'box-1', 'home', 'wt', `widgets-job-${LOST}`);
  mkdirSync(join(root, 'box-1', 'home', 'wt'), { recursive: true });
  git(box1, 'worktree', 'add', '-q', '--no-track', '-b', `agent/job-${LOST}`, folder, 'origin/main');
  const slice = join(folder, '.claude', 'worktrees', 's3');
  git(folder, 'worktree', 'add', '-q', '--no-track', '-b', 'feat/x--s3', slice, 'origin/main');
  writeFileSync(join(slice, 'slice.ts'), 'export const one = 1;\n');
  git(slice, 'add', '-A');
  git(slice, 'commit', '-q', '-m', 'slice: one');
  writeFileSync(join(slice, 'more.ts'), 'export const more = true;\n');
  const save = saveJob({ exec, checkout: box1, folder, job: LOST, repo: 'acme/widgets', runner: 'box-1', author: null, now: T0 });
  if (save?.bundle == null) throw new Error('nothing saved');
  const manifest = CheckpointManifestSchema.parse({
    job: LOST, runner: 'box-1', repo: 'acme/widgets', kind: 'portable', savedAt: save.savedAt, keepUntil: save.keepUntil, bundleBytes: save.bundleBytes, bytes: save.bytes,
    branches: save.branches, handoff: 'Next: the route.', failed: null,
  });
  return { bytes: new Uint8Array(readFileSync(save.bundle)), manifest };
}

/**
 * A fake app that hands `job` to the first `next`, answers each report with `answer` and records it, and stops the runner
 * once the job's last report came; its checkpoint calls record what they were asked.
 */
function fakeApp(job: RunnerJob, { answer = () => ({ cancel: false }), bundle = new Uint8Array() }: { answer?: (update: JobUpdate) => Updated; bundle?: Uint8Array } = {}) {
  const stop = new AbortController();
  const clock = { now: T0 };
  const updates: JobUpdate[] = [];
  const checkpoints: { calls: string[]; records: SaveRecord[]; downloads: string[] } = { calls: [], records: [], downloads: [] };
  let handed = false;
  const saves: CheckpointApi & CheckpointDownload = {
    link: (id, bytes) => {
      checkpoints.calls.push(`link ${id} ${String(bytes > 0)}`);
      return Promise.resolve({ path: `ws/${id}/b.bundle`, url: 'https://store.test/upload', expiresAt: '2026-11-13T14:00:00Z' });
    },
    upload: () => {
      checkpoints.calls.push('upload');
      return Promise.resolve();
    },
    record: (id, save) => {
      checkpoints.calls.push(`record ${id} ${save.kind}`);
      checkpoints.records.push(save);
      return Promise.resolve({ id: 'c1', kind: save.kind, keepUntil: '2026-11-20T12:00:00Z' });
    },
    download: (url) => {
      checkpoints.downloads.push(url);
      return Promise.resolve(bundle);
    },
  };
  const api: RunnerApi = {
    register: () => Promise.resolve({ id: 'r1' }),
    next: (_runner, signal) => {
      if (!handed) {
        handed = true;
        return Promise.resolve(job);
      }
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve(null);
        }, { once: true });
      });
    },
    update: (_id, update) => {
      updates.push(update);
      if (update.status !== 'running') setImmediate(() => { stop.abort(); });
      return Promise.resolve(answer(update));
    },
    githubToken: () => Promise.resolve({ token: TOKEN, expiresAt: GRANT.expiresAt }),
    health: () => Promise.resolve(),
    checkpoints: saves,
  };
  return { api, stop, clock, updates, checkpoints };
}

/** Runs box-3 on `app` until the job's last report: what it printed, each session it started, and every release it made. */
async function run(f: ReturnType<typeof fixture>, app: ReturnType<typeof fakeApp>, session: (started: JobSession) => void) {
  const printed: string[] = [];
  const sessions: JobSession[] = [];
  const releases: EndedJob[] = [];
  await runRunner({
    name: 'box-3', slots: 1, timeoutMs: 60 * 60 * 1000, version: '0.0.630', checkouts: new Map([['acme/widgets', f.checkout]]), api: app.api,
    terminal: {
      start: (started) => {
        sessions.push(started);
        session(started);
      },
      stop: () => undefined,
      alive: () => true,
    },
    exec, home: f.home, wrapper: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'job'], env: { PATH: '/usr/bin' },
    print: (line) => printed.push(line), stop: app.stop.signal, now: () => app.clock.now,
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
      app.clock.now += ms;
      setImmediate(resolve);
    }),
    machine: MACHINE, githubToken: ['/usr/bin/node', '/opt/omni.mjs', 'runner', 'github-token'],
    release: (ended): Released => {
      releases.push(ended);
      return { released: [], releaseError: null };
    },
  });
  return { printed, sessions, releases };
}

/** The file `flag` names in a session's arguments. */
const argOf = (started: JobSession, flag: string): string => started.argv[started.argv.indexOf(flag) + 1] ?? '';

/** A session that ends at once, exit code 0. */
const endsAt = (code: string) => (started: JobSession): void => {
  writeFileSync(argOf(started, '--exit'), `${code}\n`);
};

const job = (over: Partial<RunnerJob> = {}): RunnerJob => ({ id: JOB, line: '/omni:wave 2809', repo: 'acme/widgets', sentBy: 'mo', sentByKey: null, github: GRANT, allowedSkills: [], ...over });

describe('a resume on the runner (PRD 2809, s5)', () => {
  it('fetches its chain\'s save as omni-checkpoint/<branch>, writes its note, and points its session\'s prompt at it', async () => {
    const f = fixture();
    const saved = box1Save(f.root, f.origin);
    const resume: ResumeClaim = { attempt: 2, chain: [LOST], saves: [{ job: LOST, kind: 'portable', manifest: saved.manifest, url: 'https://store.test/download', expiresAt: null }] };
    const app = fakeApp(job({ resume }), { bundle: saved.bytes });
    let line = '';
    const { printed, releases } = await run(f, app, (started) => {
      line = readFileSync(argOf(started, '--line'), 'utf8');
      endsAt('0')(started);
    });
    const note = join(f.home, 'logs', `job-${JOB}.resume.md`);
    expect(app.checkpoints.downloads).toEqual(['https://store.test/download']);
    expect(line).toBe(`/omni:wave 2809\n\nThis job is attempt 2 of 3: it resumes job ${LOST}, which its runner lost. Before anything else, read ${note} and follow it.\n`);
    expect(readFileSync(note, 'utf8')).toContain(`- \`feat/x--s3\` as \`omni-checkpoint/feat/x--s3\` (job ${LOST} on box-1): 1 file, 1 commit; origin has no such branch`);
    expect(readFileSync(note, 'utf8')).toContain('Next: the route.');
    expect(git(f.checkout, 'show', 'omni-checkpoint/feat/x--s3:more.ts')).toBe('export const more = true;\n');
    expect(printed).toContain(`job ${JOB}: attempt 2 of 3, 1 branch came back`);
    expect(readChain(f.home, JOB)).toEqual({ attempt: 2, chain: [LOST] });
    // Done, it releases its own claims and those of the job it resumed that it never took over.
    expect(releases.map((ended) => ended.id)).toEqual([JOB, LOST]);
    expect(app.updates.at(-1)).toMatchObject({ status: 'done' });
  });

  it('gives a job that resumes none its line alone, and keeps it as a first attempt', async () => {
    const f = fixture();
    const app = fakeApp(job());
    let line = '';
    await run(f, app, (started) => {
      line = readFileSync(argOf(started, '--line'), 'utf8');
      endsAt('0')(started);
    });
    expect(line).toBe('/omni:wave 2809\n');
    expect(existsSync(join(f.home, 'logs', `job-${JOB}.resume.md`))).toBe(false);
    expect(readChain(f.home, JOB)).toEqual({ attempt: 1, chain: [] });
  });
});

describe('a job the app ended meanwhile (PRD 2809, s5)', () => {
  /** The session leaves an uncommitted file in the job's worktree, and runs on until the runner stops it. */
  const leavesWork = (started: JobSession): void => {
    writeFileSync(join(started.cwd, 'unsaved.ts'), 'export const unsaved = 1;\n');
  };

  it('lost and resumed elsewhere: its work is sent to the app, and its claims stay with its chain', async () => {
    const f = fixture();
    const app = fakeApp(job(), { answer: () => ({ cancel: true, ended: LOST_WORDS }) });
    const { printed, releases } = await run(f, app, leavesWork);
    expect(app.checkpoints.calls).toEqual([`link ${JOB} true`, 'upload', `record ${JOB} portable`]);
    expect(app.checkpoints.records[0]).toMatchObject({ kind: 'portable', path: `ws/${JOB}/b.bundle`, manifest: { job: JOB, runner: 'box-3', branches: [expect.objectContaining({ branch: `agent/job-${JOB}`, files: 1 })] } });
    expect(printed).toContain(`job ${JOB}: its save went to the app`);
    expect(releases).toEqual([]);
    expect(printed).toContain(`job ${JOB}: its claims stay with its chain, whose next attempt takes them over`);
  });

  it('cancelled, or lost on its third attempt: its claims, and its chain\'s, are released', async () => {
    const cancelled = fixture();
    const byPerson = fakeApp(job(), { answer: () => ({ cancel: true, ended: 'This job has ended: cancelled. Stop it.' }) });
    expect((await run(cancelled, byPerson, leavesWork)).releases.map((ended) => ended.id)).toEqual([JOB]);

    const third = fixture();
    const resume: ResumeClaim = { attempt: 3, chain: [LOST, SECOND], saves: [] };
    const lastLoss = fakeApp(job({ resume }), { answer: () => ({ cancel: true, ended: LOST_WORDS }) });
    expect((await run(third, lastLoss, leavesWork)).releases.map((ended) => ended.id)).toEqual([JOB, LOST, SECOND]);
  });

  it('keeps a save the bucket cannot take on the runner, recorded local, saying why', async () => {
    const f = fixture();
    const app = fakeApp(job(), { answer: () => ({ cancel: true, ended: LOST_WORDS }) });
    const refusing = app.api.checkpoints;
    if (refusing === undefined) throw new Error('no checkpoints');
    refusing.upload = () => Promise.reject(new Error('the storage refused the bundle (413)'));
    const { printed } = await run(f, app, leavesWork);
    expect(app.checkpoints.calls).toEqual([`link ${JOB} true`, `record ${JOB} local`]);
    expect(printed).toContain(`job ${JOB}: its save stays on this runner (the upload failed: the storage refused the bundle (413))`);
    expect(existsSync(join(f.home, 'wt', `widgets-job-${JOB}`))).toBe(true);
  });
});
