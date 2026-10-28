// The runner's sweep (PRD 1911): what it removes — job worktrees, unpushed `agent/job-*` branches and
// job logs older than `--keep-logs` days, of jobs not running — and everything it leaves alone. Each
// test runs on a fixture checkout with its own bare origin; nothing here calls GitHub.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { branchPushed, strandedJobs, sweep, sweptLine } from './sweep.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-14T12:00:00Z');

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const exec = (file: string, args: readonly string[]): string => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A checkout `repos/widgets` of `acme/widgets` with a bare origin, and a home with `wt/` and `logs/`. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'omni-sweep-'));
  const origin = join(root, 'remote', 'acme', 'widgets.git');
  mkdirSync(origin, { recursive: true });
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
  mkdirSync(join(home, 'wt'), { recursive: true });
  mkdirSync(join(home, 'logs'), { recursive: true });
  const checkouts = new Map([['acme/widgets', checkout]]);
  /** Adds the job's worktree on its branch, as the runner does. */
  const job = (id: string): string => {
    const worktree = join(home, 'wt', `widgets-job-${id}`);
    git(checkout, 'worktree', 'add', '-q', '--no-track', '-b', `agent/job-${id}`, worktree, 'main');
    writeFileSync(join(worktree, 'big.bin'), Buffer.alloc(3 * 1024 * 1024));
    return worktree;
  };
  /** Writes `~/logs/<name>`, `days` old. */
  const log = (name: string, days: number): string => {
    const path = join(home, 'logs', name);
    writeFileSync(path, 'x'.repeat(1000));
    const at = (NOW - days * DAY) / 1000;
    utimesSync(path, at, at);
    return path;
  };
  const branches = (): string[] => git(checkout, 'branch', '--format=%(refname:short)').split('\n').filter(Boolean).sort();
  const worktrees = (): string[] => git(checkout, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree '));
  return { root, origin, checkout, home, checkouts, job, log, branches, worktrees };
}

const run = (f: ReturnType<typeof fixture>, { running = [] as string[], keepLogsDays = 14 } = {}) =>
  sweep({ home: f.home, checkouts: f.checkouts, exec, running: new Set(running), keepLogsDays, now: NOW });

describe('sweep', () => {
  it("removes a stopped job's worktree, its unpushed branch and its old logs, and counts what it freed", () => {
    const f = fixture();
    const worktree = f.job('7');
    // A job like /omni:yolo makes worktrees of its own inside its own.
    git(worktree, 'worktree', 'add', '-q', '-b', 'feat/inner', join(worktree, 'inner'), 'main');
    git(f.checkout, 'branch', 'agent/job-8');
    const logs = [f.log('job-7.log', 20), f.log('job-7.jsonl', 20), f.log('job-7.exit', 20)];

    const swept = run(f);

    expect(existsSync(worktree)).toBe(false);
    // Only the checkout's own: the job's record and the one made inside it are pruned.
    expect(f.worktrees()).toHaveLength(1);
    expect(f.branches()).toEqual(['feat/inner', 'main']);
    for (const path of logs) expect(existsSync(path)).toBe(false);
    expect(swept).toMatchObject({ worktrees: 1, branches: 2, logs: 3 });
    expect(swept.bytes).toBeGreaterThanOrEqual(3 * 1024 * 1024 + 3000);
    expect(sweptLine(swept)).toMatch(/^swept: 1 worktree, 2 branches, 3 log files · 3 MB freed$/);
  });

  it("removes an old job's parts and handoff note with its log (PRD 2537, s3)", () => {
    const f = fixture();
    const logs = [f.log('job-7.parts.json', 20), f.log('job-7.handoff.md', 20)];
    expect(run(f)).toMatchObject({ logs: 2 });
    for (const path of logs) expect(existsSync(path)).toBe(false);
  });

  it('keeps a branch with an upstream, and one present on origin', () => {
    const f = fixture();
    git(f.checkout, 'branch', 'agent/job-1');
    git(f.checkout, 'branch', '--set-upstream-to=origin/main', 'agent/job-1');
    git(f.checkout, 'branch', 'agent/job-2');
    git(f.checkout, 'push', '-q', 'origin', 'agent/job-2');

    expect(run(f)).toEqual({ worktrees: 0, branches: 0, logs: 0, bytes: 0 });
    expect(f.branches()).toEqual(['agent/job-1', 'agent/job-2', 'main']);
    expect(branchPushed(exec, f.checkout, 'agent/job-1')).toBe(true);
    expect(branchPushed(exec, f.checkout, 'agent/job-2')).toBe(true);
    git(f.checkout, 'branch', 'agent/job-3');
    expect(branchPushed(exec, f.checkout, 'agent/job-3')).toBe(false);
  });

  it('keeps every branch when origin cannot be read', () => {
    const f = fixture();
    git(f.checkout, 'branch', 'agent/job-4');
    git(f.checkout, 'remote', 'set-url', 'origin', join(f.root, 'gone.git'));
    expect(run(f).branches).toBe(0);
    expect(f.branches()).toContain('agent/job-4');
    expect(branchPushed(exec, f.checkout, 'agent/job-4')).toBe(true);
  });

  it("keeps a running job's worktree, branch and logs, however old", () => {
    const f = fixture();
    const worktree = f.job('9');
    const logs = [f.log('job-9.log', 400), f.log('job-9.line', 400)];

    expect(run(f, { running: ['9'] })).toEqual({ worktrees: 0, branches: 0, logs: 0, bytes: 0 });
    expect(existsSync(worktree)).toBe(true);
    expect(f.branches()).toContain('agent/job-9');
    for (const path of logs) expect(existsSync(path)).toBe(true);
  });

  it('never touches runner.log, another folder of ~/wt, another file of ~/logs or another branch', () => {
    const f = fixture();
    const kept = [
      f.log('runner.log', 400),
      f.log('notes.txt', 400),
      f.log('job-7', 400),
      f.log('myjob-7.log', 400),
    ];
    for (const name of ['widgets', 'other-job-7', 'widgets-job-', 'widgets-task-7', 'scratch']) {
      mkdirSync(join(f.home, 'wt', name));
      kept.push(join(f.home, 'wt', name));
    }
    writeFileSync(join(f.home, 'wt', 'widgets-job-6'), 'a file, not a folder');
    kept.push(join(f.home, 'wt', 'widgets-job-6'));
    for (const name of ['agent/task-1', 'job-2', 'agent/job-', 'feature/agent/job-3']) git(f.checkout, 'branch', name);

    expect(run(f)).toEqual({ worktrees: 0, branches: 0, logs: 0, bytes: 0 });
    for (const path of kept) expect(existsSync(path)).toBe(true);
    expect(f.branches()).toEqual(['agent/job-', 'agent/task-1', 'feature/agent/job-3', 'job-2', 'main']);
  });

  it('removes a job log only past --keep-logs days: 15 of 14, never 13, and neither of 30', () => {
    for (const [keepLogsDays, gone] of [[14, ['job-15.log']], [30, []]] as const) {
      const f = fixture();
      const young = f.log('job-13.log', 13);
      const old = f.log('job-15.log', 15);
      const swept = run(f, { keepLogsDays });
      expect(swept.logs).toBe(gone.length);
      expect(existsSync(young)).toBe(true);
      expect(existsSync(old)).toBe(gone.length === 0);
    }
  });

  it('reads no folder that is missing', () => {
    const f = fixture();
    expect(sweep({ home: join(f.root, 'nobody'), checkouts: new Map(), exec, running: new Set(), keepLogsDays: 14, now: NOW })).toEqual({ worktrees: 0, branches: 0, logs: 0, bytes: 0 });
  });
});

describe('sweptLine', () => {
  it('says nothing when nothing was removed', () => {
    expect(sweptLine({ worktrees: 0, branches: 0, logs: 0, bytes: 0 })).toBeNull();
  });

  it('counts each kind, in the singular or the plural, and the space freed', () => {
    expect(sweptLine({ worktrees: 3, branches: 6, logs: 12, bytes: 412 * 1024 * 1024 })).toBe('swept: 3 worktrees, 6 branches, 12 log files · 412 MB freed');
    expect(sweptLine({ worktrees: 0, branches: 1, logs: 1, bytes: 2048 })).toBe('swept: 0 worktrees, 1 branch, 1 log file · 2 KB freed');
    expect(sweptLine({ worktrees: 1, branches: 0, logs: 0, bytes: 3 * 1024 * 1024 * 1024 + 300 * 1024 * 1024 })).toBe('swept: 1 worktree, 0 branches, 0 log files · 3.3 GB freed');
    expect(sweptLine({ worktrees: 0, branches: 1, logs: 0, bytes: 0 })).toBe('swept: 0 worktrees, 1 branch, 0 log files · 0 KB freed');
  });
});

describe('strandedJobs (PRD 2175)', () => {
  it('names the jobs no slot holds whose worktree is left, with the repository each ran in', () => {
    const f = fixture();
    f.job('lost-1');
    f.job('running-2');
    mkdirSync(join(f.home, 'wt', 'elsewhere-job-3'));
    writeFileSync(join(f.home, 'wt', 'widgets-job-4'), 'a file, not a worktree');
    mkdirSync(join(f.home, 'wt', 'widgets-job-a b'));
    const stranded = strandedJobs({ home: f.home, checkouts: f.checkouts, running: new Set(['running-2']) });
    expect(stranded).toEqual([{ job: 'lost-1', repo: 'acme/widgets' }]);
  });

  it('names none when the home has no worktree folder', () => {
    expect(strandedJobs({ home: join(tmpdir(), 'omni-no-such-home'), checkouts: new Map([['acme/widgets', '/nowhere']]), running: new Set() })).toEqual([]);
  });
});
