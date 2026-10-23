// PRD 2485, s1: the `WorktreesHost` (`./engine.ts`) read for real. git runs in `root` (any worktree
// of the repository answers for all of them) through the injected `exec`, but for each worktree's own
// status, run in it and asynchronously; the size is `du -sk`, and the processes' working
// directories are read from `/proc/<pid>/cwd` on Linux and `lsof -a -d cwd` on macOS; anywhere else,
// or when the read fails, they cannot be read, and the engine keeps every worktree as in use.
import { execFile } from 'node:child_process';
import { readdirSync, readlinkSync, realpathSync } from 'node:fs';
import type { ExecText } from '../context.ts';
import { propertyOf } from '../narrow.ts';
import { gitLine } from './engine.ts';
import type { WorktreesHost } from './engine.ts';

/** What git wrote on stderr when it failed, as one line. */
function refusal(error: unknown): string {
  const stderr = propertyOf(error, 'stderr');
  const text = typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString('utf8') : '';
  return gitLine(text === '' && error instanceof Error ? error.message : text);
}

/** The working directory of every process `/proc` lets this user read; `null` when `/proc` cannot be read. */
function procCwds(): string[] | null {
  let pids: string[];
  try {
    pids = readdirSync('/proc').filter((name) => /^\d+$/.test(name));
  } catch {
    return null;
  }
  return pids.flatMap((pid) => {
    try {
      return [readlinkSync(`/proc/${pid}/cwd`)];
    } catch {
      // A process of another user, or one that ended since: it says nothing.
      return [];
    }
  });
}

/** The working directory of every process `lsof` lists; `null` when it cannot run. */
function lsofCwds(exec: ExecText): string[] | null {
  try {
    const text = exec('lsof', ['-a', '-d', 'cwd', '-F', 'n'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    return text.split('\n').flatMap((line) => (line.startsWith('n') ? [line.slice(1)] : []));
  } catch {
    return null;
  }
}

/** The processes' working directories on `platform`, or `null` when they cannot be read there. */
export function processCwds(platform: string, exec: ExecText): readonly string[] | null {
  if (platform === 'linux') return procCwds();
  if (platform === 'darwin') return lsofCwds(exec);
  return null;
}

/** The host of the repository at `root`, whose remote is `remote`. */
export function gitHost({ root, remote, exec, cwds }: { root: string; remote: string; exec: ExecText; cwds: () => readonly string[] | null }): WorktreesHost {
  const git = (args: readonly string[], cwd = root): string => exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const attempt = (args: readonly string[]): string | null => {
    try {
      git(args);
      return null;
    } catch (error) {
      return refusal(error);
    }
  };
  return {
    list: () => git(['worktree', 'list', '--porcelain']),
    fetch() {
      try {
        git(['fetch', '--quiet', remote]);
      } catch {
        // No network, or no such remote: the last fetch is read.
      }
    },
    unpushed(heads) {
      try {
        const out = git(['rev-list', ...heads, '--not', `--remotes=${remote}`]);
        const unreached = new Set(out.split('\n').filter(Boolean));
        return new Set(heads.filter((head) => unreached.has(head)));
      } catch {
        return new Set(heads);
      }
    },
    // Asynchronous, so that `hint` reads every worktree at once; `--no-optional-locks` never writes
    // the index of a worktree someone may be working in.
    status: (path) =>
      new Promise((resolve, reject) => {
        execFile('git', ['--no-optional-locks', 'status', '--porcelain'], { cwd: path, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) reject(new Error(gitLine(stderr === '' ? error.message : stderr)));
          else resolve(stdout);
        });
      }),
    remove: (path) => attempt(['worktree', 'remove', path]),
    deleteBranch: (branch) => attempt(['branch', '-d', branch]),
    size(path) {
      try {
        const kib = Number(exec('du', ['-sk', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\s/)[0]);
        return Number.isFinite(kib) ? kib * 1024 : null;
      } catch {
        return null;
      }
    },
    cwds,
    realpath(path) {
      try {
        return realpathSync(path);
      } catch {
        return path;
      }
    },
  };
}
