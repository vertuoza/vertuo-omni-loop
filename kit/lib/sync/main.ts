// The main check's facts (PRD 1990, spec section 5): where `HEAD` stands against
// `<remote>/<defaultBranch>`, read through `git` alone.
//
// - It fetches `<remote> <defaultBranch>` within 10 seconds, then lists the commits of the
//   remote-tracking branch that `HEAD` does not have, with when each was committed: their count,
//   and the oldest. A fetch that fails or runs out of time leaves the count not checked.
// - In the main checkout it also reads the branch, the tracked files changed, and the default
//   branch's commits the remote-tracking branch lacks. A linked worktree (one a skill cut) is judged
//   on the behind rule alone, so none of these is read there.
//
// Nothing here throws: what `git` would not say is a fact `{ notChecked: <why> }`.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { resolve } from 'node:path';
import type { ExecText } from '../context.ts';
import { propertyOf } from '../narrow.ts';
import type { Fact, MainFacts, Unchecked } from './facts.ts';

/** How long the fetch may take. */
const FETCH_BUDGET_MS = 10_000;

type MainIo = { cwd: string; exec: ExecText; remote: string; defaultBranch: string; fetchMs?: number };

/** `git <args>` in `cwd`, its output, or `null` when it fails. */
function gitOut(io: Pick<MainIo, 'cwd' | 'exec'>, args: readonly string[], timeout?: number): string | null {
  const options: ExecFileSyncOptionsWithStringEncoding = { cwd: io.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...(timeout ? { timeout } : {}) };
  try {
    return io.exec('git', args, options);
  } catch {
    return null;
  }
}

/** The non-empty lines of `text`. */
const linesOf = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter(Boolean);

/** Whether the checkout at `cwd` is a linked worktree; `null` outside a git checkout. */
function isLinked(io: MainIo): boolean | null {
  const out = gitOut(io, ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir']);
  const [gitDir, commonDir] = linesOf(out ?? '');
  if (gitDir === undefined || commonDir === undefined) return null;
  return resolve(gitDir) !== resolve(commonDir);
}

/** The fetch of the default branch, or why it did not happen. */
function fetched(io: MainIo): Unchecked | null {
  const { cwd, exec, remote, defaultBranch, fetchMs = FETCH_BUDGET_MS } = io;
  if (gitOut(io, ['remote', 'get-url', remote]) === null) return { notChecked: `no remote ${remote}` };
  try {
    exec('git', ['fetch', '--quiet', remote, defaultBranch], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: fetchMs });
    return null;
  } catch (error) {
    return { notChecked: propertyOf(error, 'code') === 'ETIMEDOUT' ? 'timed out' : 'offline' };
  }
}

/** The commits of the remote-tracking branch `HEAD` lacks: how many, and when the oldest was committed (ms). */
function behindOf(io: MainIo, tracking: string): MainFacts['behind'] {
  const out = gitOut(io, ['log', '--format=%ct', `HEAD..${tracking}`]);
  if (out === null) return { notChecked: 'git log failed' };
  const times = linesOf(out).map((line) => Number.parseInt(line, 10) * 1000).filter((time) => Number.isFinite(time));
  return { count: times.length, oldestAt: times.length > 0 ? Math.min(...times) : null };
}

/** How many tracked files are changed. */
function changedOf(io: MainIo): Fact<number> {
  const out = gitOut(io, ['status', '--porcelain', '--untracked-files=no']);
  return out === null ? { notChecked: 'git status failed' } : linesOf(out).length;
}

/** The default branch's commits the remote-tracking branch lacks; none without a local default branch. */
function unpushedOf(io: MainIo, tracking: string, hasTracking: boolean): Fact<number> {
  const local = `refs/heads/${io.defaultBranch}`;
  if (gitOut(io, ['rev-parse', '--verify', '--quiet', local]) === null) return 0;
  if (!hasTracking) return { notChecked: `no ${io.remote}/${io.defaultBranch}` };
  const count = Number.parseInt(gitOut(io, ['rev-list', '--count', `${tracking}..${local}`]) ?? '', 10);
  return Number.isNaN(count) ? { notChecked: 'git rev-list failed' } : count;
}

/** The main check's facts for the checkout at `cwd`, or why there are none. */
export function mainFacts(io: MainIo): MainFacts | Unchecked {
  const linked = isLinked(io);
  if (linked === null) return { notChecked: 'not a git checkout' };
  const { remote, defaultBranch } = io;
  const branch = linesOf(gitOut(io, ['symbolic-ref', '--quiet', '--short', 'HEAD']) ?? '')[0] ?? null;
  const tracking = `refs/remotes/${remote}/${defaultBranch}`;
  const failed = fetched(io);
  const hasTracking = gitOut(io, ['rev-parse', '--verify', '--quiet', tracking]) !== null;
  const missing = { notChecked: `no ${remote}/${defaultBranch}` };
  const behind = failed ?? (hasTracking ? behindOf(io, tracking) : missing);
  if (linked) return { remote, defaultBranch, linked, branch, behind, changed: 0, unpushed: 0 };
  return { remote, defaultBranch, linked, branch, behind, changed: changedOf(io), unpushed: unpushedOf(io, tracking, hasTracking) };
}
