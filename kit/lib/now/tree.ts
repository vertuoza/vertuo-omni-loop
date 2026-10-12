// What `omni now` reads of git and the checkout (PRD 1208): the base, the folders under a directory in
// the checkout's working tree and on the base, and a file on the base. Each read goes through the
// injected `exec`, quietly, and one that cannot be read counts as absent: nothing here throws, prints,
// fetches or writes.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Context, ExecText } from '../context.ts';

export const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

/** The folders under one directory: those in the checkout's working tree, and those on the base. */
export type Folders = { checkout: string[]; base: string[] };

/** `fn()`, or `fallback` when it throws. */
export function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The base's ref: the remote-tracking default branch, else the local one, else `null`. */
export function baseOf(ctx: Context, exec: ExecText): string | null {
  const { remote, defaultBranch } = ctx.config.repo;
  const refs = [`refs/remotes/${remote}/${defaultBranch}`, `refs/heads/${defaultBranch}`];
  return refs.find((ref) => attempt(() => exec('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: ctx.root, ...QUIET }) !== '', false)) ?? null;
}

/** The folders under `dir`, in the checkout and on `base`. */
export function foldersAt(ctx: Context, dir: string, base: string | null, exec: ExecText): Folders {
  const checkout = attempt(() => readdirSync(join(ctx.root, dir), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name), []);
  const onBase = base ? attempt(() => exec('git', ['ls-tree', '-z', '-d', '--name-only', `${base}:${dir}`], { cwd: ctx.root, ...QUIET }).split('\0').filter(Boolean), []) : [];
  return { checkout, base: onBase };
}

/** The text of `path` on `base`, or `null`. */
export function textOnBase(ctx: Context, base: string | null, path: string, exec: ExecText): string | null {
  return base ? attempt<string | null>(() => exec('git', ['show', `${base}:${path}`], { cwd: ctx.root, ...QUIET }), null) : null;
}
