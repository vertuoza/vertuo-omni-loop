// The runner's sweep (PRD 1911, "The sweep"): once when the runner starts, then every hour while it
// runs, it removes what jobs left behind and no running job holds — and nothing else:
//
// - each `~/wt/<repo>-job-<id>` folder, `<repo>` the name of a checkout held, then
//   `git worktree prune` in every checkout;
// - each local `agent/job-<id>` branch of those checkouts, unless it was pushed: it has an upstream,
//   or `origin` has a branch of that name. Origin unreadable, every branch of that checkout stays;
// - each `~/logs/job-<id>.<ext>` file older than `--keep-logs` days, `<ext>` one or more parts (`.parts.json`, PRD 2537).
//
// `~/logs/runner.log`, any other folder, file or branch is never touched. The line it prints counts
// what went and the space freed; a sweep that removed nothing prints nothing.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { lstatSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecText } from '../context.ts';

/** What a sweep removed, and the bytes it freed. */
export type Swept = { worktrees: number; branches: number; logs: number; bytes: number };

export type SweepOptions = {
  /** Where `wt/` and `logs/` live: the person's home. */
  home: string;
  /** The checkouts the runner holds, by `owner/name`. */
  checkouts: ReadonlyMap<string, string>;
  exec: ExecText;
  /** The ids of the jobs the runner holds in a slot: nothing of theirs is touched. */
  running: ReadonlySet<string>;
  keepLogsDays: number;
  now: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
/** A job id as the runner names its files: letters, digits, dashes and underscores. */
const ID = '[A-Za-z0-9_-]+';
const JOB_ID = new RegExp(`^${ID}$`);
const JOB_BRANCH =new RegExp(`^agent/job-(${ID})$`);
const JOB_LOG = new RegExp(`^job-(${ID})(?:\\.[A-Za-z0-9]+)+$`);

/** The names in `dir`, or none when it cannot be read. */
function namesIn(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** The bytes under `path`, symbolic links counted as themselves and never followed. */
function sizeOf(path: string): number {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.size;
  return namesIn(path).reduce((total, name) => total + sizeOf(join(path, name)), stat.size);
}

/** The job id of a `~/wt` folder `<repo>-job-<id>`, `<repo>` one of `repoNames`, or `null`. */
function worktreeJob(name: string, repoNames: readonly string[]): string | null {
  for (const repo of repoNames) {
    const prefix = `${repo}-job-`;
    const job = name.startsWith(prefix) ? name.slice(prefix.length) : '';
    if (JOB_ID.test(job)) return job;
  }
  return null;
}

/** The branch names on `checkout`'s origin, or `null` when origin cannot be read. */
function originBranches(exec: ExecText, checkout: string): Set<string> | null {
  try {
    const out = exec('git', ['-C', checkout, 'ls-remote', '--heads', 'origin'], QUIET);
    return new Set(out.split('\n').map((line) => /\trefs\/heads\/(.+)$/.exec(line)?.[1]).filter((name) => name !== undefined));
  } catch {
    return null;
  }
}

/** Whether `branch` has an upstream in `checkout`. */
function hasUpstream(exec: ExecText, checkout: string, branch: string): boolean {
  try {
    return exec('git', ['-C', checkout, 'for-each-ref', '--format=%(upstream)', `refs/heads/${branch}`], QUIET).trim() !== '';
  } catch {
    return true;
  }
}

/** Whether `branch` counts as pushed: it has an upstream, or origin has it. Origin unreadable, it does. */
export function branchPushed(exec: ExecText, checkout: string, branch: string): boolean {
  return hasUpstream(exec, checkout, branch) || (originBranches(exec, checkout)?.has(branch) ?? true);
}

/** Deletes the local `branch`: whether it went. */
function deleteBranch(exec: ExecText, checkout: string, branch: string): boolean {
  try {
    exec('git', ['-C', checkout, 'branch', '-D', branch], QUIET);
    return true;
  } catch {
    return false;
  }
}

/** Drops the records of worktrees whose folder is gone. */
export function pruneWorktrees(exec: ExecText, checkout: string): void {
  try {
    exec('git', ['-C', checkout, 'worktree', 'prune'], QUIET);
  } catch {
    // A checkout git cannot read has nothing to prune.
  }
}

/** Deletes a stopped job's branch unless it was pushed: whether it went. */
export function dropJobBranch(exec: ExecText, checkout: string, branch: string): boolean {
  return !branchPushed(exec, checkout, branch) && deleteBranch(exec, checkout, branch);
}

/** A job no slot holds whose worktree is still there: its id and the repository it ran in. */
export type StrandedJob = { job: string; repo: string };

/**
 * The jobs whose `~/wt/<repo>-job-<id>` folder is there while no slot holds them, `<repo>` the name of
 * a checkout held: what a runner that died, or restarted, left. The app marks them lost (#2170).
 */
export function strandedJobs({ home, checkouts, running }: Pick<SweepOptions, 'home' | 'checkouts' | 'running'>): StrandedJob[] {
  const wt = join(home, 'wt');
  const stranded: StrandedJob[] = [];
  for (const name of namesIn(wt)) {
    const repo = [...checkouts.keys()].find((held) => worktreeJob(name, [held.split('/').at(-1) ?? held]) !== null);
    const job = repo === undefined ? null : worktreeJob(name, [repo.split('/').at(-1) ?? repo]);
    if (repo === undefined || job === null || running.has(job) || !lstatSync(join(wt, name)).isDirectory()) continue;
    stranded.push({ job, repo });
  }
  return stranded;
}

/** Removes the `~/wt` folders of jobs not running: how many, and their bytes. */
function sweepWorktrees({ home, checkouts, running }: SweepOptions): { count: number; bytes: number } {
  const wt = join(home, 'wt');
  const repoNames = [...checkouts.keys()].map((repo) => repo.split('/').at(-1) ?? repo);
  let count = 0;
  let bytes = 0;
  for (const name of namesIn(wt)) {
    const job = worktreeJob(name, repoNames);
    const path = join(wt, name);
    if (job === null || running.has(job) || !lstatSync(path).isDirectory()) continue;
    const size = sizeOf(path);
    rmSync(path, { recursive: true, force: true });
    count += 1;
    bytes += size;
  }
  return { count, bytes };
}

/** Deletes the unpushed `agent/job-*` branches of jobs not running in `checkout`: how many went. */
function sweepBranches({ exec, running }: SweepOptions, checkout: string): number {
  let names: string[];
  try {
    names = exec('git', ['-C', checkout, 'for-each-ref', '--format=%(refname:short)%09%(upstream)', 'refs/heads/agent/'], QUIET).split('\n');
  } catch {
    return 0;
  }
  const candidates = names
    .map((line) => line.split('\t'))
    .filter(([name = '', upstream = '']) => upstream === '' && !running.has(JOB_BRANCH.exec(name)?.[1] ?? ''))
    .map(([name = '']) => name)
    .filter((name) => JOB_BRANCH.test(name));
  if (candidates.length === 0) return 0;
  const onOrigin = originBranches(exec, checkout);
  if (onOrigin === null) return 0;
  return candidates.filter((name) => !onOrigin.has(name) && deleteBranch(exec, checkout, name)).length;
}

/** Removes the `~/logs/job-<id>.*` files older than `keepLogsDays` of jobs not running. */
function sweepLogs({ home, running, keepLogsDays, now }: SweepOptions): { count: number; bytes: number } {
  const logs = join(home, 'logs');
  let count = 0;
  let bytes = 0;
  for (const name of namesIn(logs)) {
    const job = JOB_LOG.exec(name)?.[1];
    if (job === undefined || running.has(job)) continue;
    const path = join(logs, name);
    const stat = lstatSync(path);
    if (!stat.isFile() || now - stat.mtimeMs <= keepLogsDays * DAY_MS) continue;
    rmSync(path, { force: true });
    count += 1;
    bytes += stat.size;
  }
  return { count, bytes };
}

/** One sweep: worktrees first, so their branches can go, then branches, then logs. */
export function sweep(options: SweepOptions): Swept {
  const worktrees = sweepWorktrees(options);
  let branches = 0;
  for (const checkout of options.checkouts.values()) {
    pruneWorktrees(options.exec, checkout);
    branches += sweepBranches(options, checkout);
  }
  const logs = sweepLogs(options);
  return { worktrees: worktrees.count, branches, logs: logs.count, bytes: worktrees.bytes + logs.bytes };
}

const count = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;

/** `bytes` read by a person: KB under a megabyte, MB under a gigabyte, else GB with one decimal. */
function sizeText(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${String(Math.round(kb))} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${String(Math.round(mb))} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** The line a sweep prints, or `null` when it removed nothing. */
export function sweptLine(swept: Swept): string | null {
  if (swept.worktrees + swept.branches + swept.logs === 0) return null;
  const what = [count(swept.worktrees, 'worktree', 'worktrees'), count(swept.branches, 'branch', 'branches'), count(swept.logs, 'log file', 'log files')];
  return `swept: ${what.join(', ')} · ${sizeText(swept.bytes)} freed`;
}
