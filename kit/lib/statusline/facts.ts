// What the status line reads besides Claude Code's JSON (PRD 324's spec, "How it is built"): the one
// module that touches git and the disk (with `sessions.ts`, through which it reads the session's
// record, and `board-cache.ts`, through which it reads the cached board), so that `input.ts`,
// `which-prd.ts`, `stage.ts` and `render.ts` stay pure. Each fact is read on its own, and one that
// cannot be read counts as absent: nothing here prints, fetches, runs `gh` or writes a file. Every
// git call goes through the injected `exec`; the one process it may start, the board's background
// refresh, through the injected `spawn` (none without it).
//
// - `installed` — a config loads in the checkout of the session's folder (`input.currentDir`, else
//   the process's own folder): the loop is installed there, and line 2 is printed.
// - `askOn` — ask mode is on in the checkout Claude Code was launched from: the file the ask hooks
//   read, under `input.projectDir`, read with the kit's own `readMode`. Nothing is called to know it.
// - `prd` — the PRD the session's branch names, else the one the session's record names
//   (`which-prd.ts`), and where it stands (`stage.ts`), as `{ number, topic, slice, stage,
//   openItems }`, or `null` for no PRD. Read from git as of the last fetch:
//   - the branch: `git rev-parse --abbrev-ref HEAD` in the session's folder;
//   - the record: the one `input.sessionId` names, in the main checkout of the session's folder;
//   - the base: `<repo.remote>/<repo.defaultBranch>` when that ref exists, else the local
//     `<repo.defaultBranch>`, else none (and no stage);
//   - the PRD folders: the delivery folder's inbox and shipped folders in the checkout's working tree
//     and on the base;
//   - the feature branch: `<repo.remote>/<branches.feature>` with the topic, its changes against the
//     base (`git diff`) and the files of its outbox folder (`git ls-tree`);
//   - the board, for a PRD whose folder is in the base inbox only: the cached board file in the main
//     checkout of the session's folder, whose slices count for the stage and show in the outbox
//     while under 10 minutes old; when it is missing or a minute old, its refresh is started in the
//     session's folder, never waited for.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readMode } from '../ask/local-state.ts';
import { fillBranch } from '../board.ts';
import { loadConfig } from '../config.ts';
import { createContext } from '../context.ts';
import type { Context, ExecText } from '../context.ts';
import { mainCheckout } from '../dossier/local.ts';
import { findRoot } from '../init/repo.ts';
import { cachedSlices } from './board-cache.ts';
import type { Spawn } from './board-cache.ts';
import type { SessionInput } from './input.ts';
import type { CachedSlice } from './schema.ts';
import { recordedPrd } from './sessions.ts';
import { isBuilt, openItemCount, stageOf } from './stage.ts';
import type { FeatureFacts, PrdStage } from './stage.ts';
import { branchNames, whichPrd } from './which-prd.ts';

/** The PRD line's facts: the PRD, the slice its branch names, where it stands, and its board. */
export type PrdFacts = {
  number: number;
  topic: string;
  slice: string | null;
  stage: PrdStage | null;
  openItems: number;
  slices: CachedSlice[] | null;
};

/** What the status line reads besides Claude Code's JSON. */
export type Facts = { installed: boolean; askOn: boolean; prd: PrdFacts | null };

/** What the board's refresh needs to start, as `readFacts` passes it on. */
type Refresh = { now: number; spawn: Spawn | null; env: NodeJS.ProcessEnv | undefined };

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

/** `fn()`, or `fallback` when it throws. */
function attempt<T, F>(fn: () => T, fallback: F): T | F {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const git = (exec: ExecText, cwd: string, args: string[]): string => exec('git', args, { cwd, ...QUIET });
/** The entries of a `-z` output. */
const entries = (text: string): string[] => text.split('\0').filter(Boolean);

/** The context of the checkout `folder` sits in, or `null` when it is no repository or its config does not load. */
function checkoutContext(folder: string, exec: ExecText): Context | null {
  try {
    const root = findRoot(folder, exec);
    return createContext(root, loadConfig(root));
  } catch {
    return null;
  }
}

function askModeOn(projectDir: string | null): boolean {
  if (!projectDir) return false;
  try {
    return readMode(projectDir) !== null;
  } catch {
    return false;
  }
}

/** The branch checked out in `folder`, or `null`. A detached head reads `HEAD`, which no template reads. */
function branchOf(folder: string, exec: ExecText): string | null {
  return attempt(() => git(exec, folder, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(), null);
}

function refExists(ctx: Context, ref: string, exec: ExecText): boolean {
  return attempt(() => {
    git(exec, ctx.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  }, false);
}

/** The base: the remote-tracking default branch, else the local one, else `null`. */
function baseRef(ctx: Context, exec: ExecText): string | null {
  const { remote, defaultBranch } = ctx.config.repo;
  const refs = [`refs/remotes/${remote}/${defaultBranch}`, `refs/heads/${defaultBranch}`];
  return refs.find((ref) => refExists(ctx, ref, exec)) ?? null;
}

/** The folder names under `dir` in `ref`'s tree; `[]` when it cannot be read. */
function treeFolders(ctx: Context, ref: string, dir: string, exec: ExecText): string[] {
  return attempt(() => entries(git(exec, ctx.root, ['ls-tree', '-z', '-d', '--name-only', `${ref}:${dir}`])), []);
}

/** Every file under `dir` in `ref`'s tree, relative to `dir`; `[]` when it cannot be read. */
function treeFiles(ctx: Context, ref: string, dir: string, exec: ExecText): string[] {
  return attempt(() => entries(git(exec, ctx.root, ['ls-tree', '-z', '-r', '--name-only', `${ref}:${dir}`])), []);
}

/** The folder names under `dir` in the checkout's working tree; `[]` when it cannot be read. */
function checkoutFolders(ctx: Context, dir: string): string[] {
  return attempt(
    () => readdirSync(join(ctx.root, dir), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    [],
  );
}

/** The paths `git diff --name-only` names between `from` and `to` (`...` when `sinceFork`); `[]` when it cannot be read. */
function changedPaths(ctx: Context, { from, to, sinceFork }: { from: string; to: string; sinceFork: boolean }, exec: ExecText): string[] {
  const range = sinceFork ? [`${from}...${to}`] : [from, to];
  return attempt(() => entries(git(exec, ctx.root, ['diff', '--name-only', '-z', '--no-renames', ...range, '--'])), []);
}

/** What the PRD's feature branch holds: `{ built, openItems }`, or `null` when it does not exist. */
function featureFacts(ctx: Context, { base, topic, folder }: { base: string; topic: string; folder: string }, exec: ExecText): FeatureFacts | null {
  const { remote } = ctx.config.repo;
  const feature = `refs/remotes/${remote}/${fillBranch(ctx.config.branches.feature, { topic })}`;
  if (!refExists(ctx, feature, exec)) return null;
  return {
    built: isBuilt({
      forkChanges: changedPaths(ctx, { from: base, to: feature, sinceFork: true }, exec),
      stillDiffers: changedPaths(ctx, { from: base, to: feature, sinceFork: false }, exec),
      delivery: ctx.config.paths.delivery,
    }),
    openItems: openItemCount(treeFiles(ctx, feature, `${ctx.layout.dirs.outbox}/${folder}`, exec)),
  };
}

/** The slices PRD `prd`'s cached board shows, read in the main checkout of `folder`, its refresh
 * started in `folder` when due and `spawn` is given; `null` for none. */
function boardSlices({ folder, prd, now, spawn, env }: Refresh & { folder: string; prd: number }, exec: ExecText): CachedSlice[] | null {
  const root = attempt(() => mainCheckout(folder, exec), null);
  return root ? cachedSlices({ root, prd, now, cwd: folder, spawn, env }) : null;
}

/** The PRD the branch checked out in `folder` names, else the one session `sessionId`'s record names,
 * and where it stands; `null` for no PRD. */
function readPrd(ctx: Context, { folder, sessionId, now, spawn, env }: Refresh & { folder: string; sessionId: string | null }, exec: ExecText): PrdFacts | null {
  const branch = branchOf(folder, exec);
  const { branches } = ctx.config;
  const recorded = recordedPrd({ cwd: folder, exec, sessionId });
  if (!branchNames(branch, branches) && recorded === null) return null;
  const { inbox, shipped } = ctx.layout.dirs;
  const base = baseRef(ctx, exec);
  const onBase = base ? { inbox: treeFolders(ctx, base, inbox, exec), shipped: treeFolders(ctx, base, shipped, exec) } : null;
  const folders = [...checkoutFolders(ctx, inbox), ...checkoutFolders(ctx, shipped), ...(onBase ? [...onBase.inbox, ...onBase.shipped] : [])];
  const found = whichPrd({ branch, branches, folders, recorded });
  if (!found) return null;
  const feature = base ? featureFacts(ctx, { base, topic: found.topic, folder: found.folder }, exec) : null;
  const inBaseInbox = Boolean(onBase?.inbox.includes(found.folder) && !onBase.shipped.includes(found.folder));
  const slices = inBaseInbox ? boardSlices({ folder, prd: found.prd, now, spawn, env }, exec) : null;
  return {
    number: found.prd,
    topic: found.topic,
    slice: found.slice,
    stage: stageOf({ folder: found.folder, base: onBase, feature, slices }),
    openItems: feature?.openItems ?? 0,
    slices,
  };
}

/**
 * The facts for `input`, `parseInput`'s result, from the options: the process's own folder,
 * `execFileSync`, the clock in milliseconds, and `spawn` with the environment the board's refresh
 * starts with (no refresh starts without `spawn`).
 */
export function readFacts(
  input: Pick<SessionInput, 'currentDir' | 'projectDir' | 'sessionId'>,
  { cwd, exec, now = Date.now(), spawn = null, env }: { cwd: string; exec: ExecText; now?: number; spawn?: Spawn | null; env?: NodeJS.ProcessEnv | undefined },
): Facts {
  const folder = input.currentDir ?? cwd;
  const ctx = checkoutContext(folder, exec);
  return {
    installed: ctx !== null,
    askOn: askModeOn(input.projectDir),
    prd: ctx ? readPrd(ctx, { folder, sessionId: input.sessionId, now, spawn, env }, exec) : null,
  };
}
