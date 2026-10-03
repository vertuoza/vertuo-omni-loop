// The board the status line shows (PRD 324's spec, "The board"): a file the background refresh writes
// in the main checkout, so that the status line itself never waits on GitHub (the spec's D5 and D12).
//
// - The file is `.omni-loop/local/statusline/board-<n>.json`, in the repository's main checkout,
//   holding `{ "at": "<iso time>", "slices": [{ "id", "wave", "state" }] }` after a refresh that
//   worked, or `{ "at": "<iso time>", "error": "<one line>" }` after one that failed. The local
//   folder carries its own `.gitignore` (`*`), as ask mode's does: nothing in it is ever committed.
// - **Shown** when it holds slices and its `at` is under 10 minutes old. An error, a missing file or
//   an older board shows none. A file whose `at` cannot be read reads as missing; one whose slices
//   cannot be read, as an error.
// - **Refreshed** when the file is missing or its `at` is 60 seconds old or more (a time after now
//   counts as old), and no refresh holds the lock: the status line starts
//   `node <this omni.mjs> statusline --refresh <n>` detached, its output ignored, in the session's
//   folder, and never waits for it. The spawn is injected; without one, nothing starts.
// - **The refresh** takes the lock `board-<n>.lock`, created exclusively. One 2 minutes old or more
//   is abandoned and taken over; a younger one means another refresh is running, and this one
//   writes nothing. It builds the board, writes the file to a temporary name and renames it into
//   place, then removes the lock, unless another refresh took it over meanwhile. Any failure is
//   written as the error entry, so that the next try comes 60 seconds later, not on every render.
import type { SpawnOptions } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_DIR } from '../ask/local-state.ts';
import { runningBundle } from '../init/bundle.ts';
import { BoardFileSchema, LockFileSchema } from './schema.ts';
import type { CachedSlice } from './schema.ts';

/** A PRD's cached board, `at` in milliseconds: its slices after a refresh that worked, else its error. */
export type Board = { at: number; slices: CachedSlice[]; error?: undefined } | { at: number; error: string; slices?: undefined };

/** A slice as a refresh writes it: one of a plan with no `wave` column writes `null`, which reads back as no slices. */
type WrittenSlice = { id: string; wave: number | null; state: string };

/** An entry as a refresh writes it. */
type WrittenEntry = { at: string; slices: WrittenSlice[] } | { at: string; error: string };

/** What starts the refresh: shaped like `spawn` from `node:child_process`; its child may be anything. */
export type Spawn = (command: string, args: readonly string[], options: SpawnOptions) => {
  on?: (event: 'error', listener: (error: Error) => void) => unknown;
  unref?: () => unknown;
} | null | undefined;

/** `value[key]` for an object `value`, else `undefined`. */
const prop = (value: unknown, key: string): unknown => (typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined);

export const BOARD_DIR = join(LOCAL_DIR, 'statusline');
/** How old a board may be before the status line starts a refresh. */
export const REFRESH_AFTER_MS = 60 * 1000;
/** How old a board may be and still be shown. */
export const SHOWN_UNDER_MS = 10 * 60 * 1000;
/** How old a lock may be before it reads as abandoned. */
export const LOCK_ABANDONED_MS = 2 * 60 * 1000;
const UNREADABLE = 'the board file holds no slices it can read';

export const boardFile = (root: string, prd: number): string => join(root, BOARD_DIR, `board-${prd}.json`);
export const lockFile = (root: string, prd: number): string => join(root, BOARD_DIR, `board-${prd}.lock`);

/** `fn()`, or `fallback` when it throws. */
function attempt<T, F>(fn: () => T, fallback: F): T | F {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The `.omni-loop` file that runs this `omni`: the bundle when bundled, else the kit source's entry. */
export function omniScript(): string {
  return runningBundle() ?? fileURLToPath(new URL('../../bin/omni.ts', import.meta.url));
}

/** PRD `prd`'s board in the checkout at `root`: `{ at, slices }` or `{ at, error }` (`at` in
 * milliseconds), or `null` when the file is missing or its time cannot be read. */
export function readBoard(root: string, prd: number): Board | null {
  const value = attempt((): unknown => JSON.parse(readFileSync(boardFile(root, prd), 'utf8')), null);
  const parsed = BoardFileSchema.safeParse(value);
  if (!parsed.success) return null;
  const at = Date.parse(parsed.data.at);
  if (Number.isNaN(at)) return null;
  const { slices, error } = parsed.data;
  if (slices) return { at, slices };
  return { at, error: error ?? UNREADABLE };
}

/** How long before `now` the board was written; `null` for no board or one written after `now`. */
function ageOf(board: Board | null | undefined, now: number): number | null {
  if (!board) return null;
  const age = now - board.at;
  return age >= 0 ? age : null;
}

/** The slices to show: the board's, when it holds slices under 10 minutes old; else `null`. */
export function shownSlices(board: Board | null | undefined, now: number): CachedSlice[] | null {
  const age = ageOf(board, now);
  return board?.slices && age !== null && age < SHOWN_UNDER_MS ? board.slices : null;
}

/** Whether a refresh is due: no board, or one 60 seconds old or more. */
export function refreshDue(board: Board | null | undefined, now: number): boolean {
  const age = ageOf(board, now);
  return age === null || age >= REFRESH_AFTER_MS;
}

/** The lock in `path`, read; `null` when it cannot be read or is not the shape. */
function readLock(path: string): { at?: string | undefined; owner?: string | undefined } | null {
  const parsed = LockFileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  return parsed.success ? parsed.data : null;
}

/** When the lock in `path` was taken: its `at`, else the file's own time; `null` without a lock. */
function lockedAt(path: string): number | null {
  if (!existsSync(path)) return null;
  const at = attempt(() => Date.parse(readLock(path)?.at ?? ''), Number.NaN);
  return Number.isNaN(at) ? attempt(() => statSync(path).mtimeMs, null) : at;
}

/** Whether a refresh of PRD `prd` holds the lock: one under 2 minutes old (a time after `now` counts as old). */
export function lockHeld(root: string, prd: number, now: number): boolean {
  const at = lockedAt(lockFile(root, prd));
  return at !== null && now - at >= 0 && now - at < LOCK_ABANDONED_MS;
}

/**
 * Starts `node <script> statusline --refresh <prd>` in `cwd`, detached, its output ignored, and lets
 * it go. Never waits, never throws: a child that fails to start is ignored.
 */
export function startRefresh({ spawn, script, cwd, prd, env }: { spawn: Spawn; script: string; cwd: string; prd: number; env?: NodeJS.ProcessEnv | undefined }): void {
  try {
    const child = spawn(process.execPath, [script, 'statusline', '--refresh', String(prd)], {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      ...(env ? { env } : {}),
    });
    child?.on?.('error', () => {});
    child?.unref?.();
  } catch {
    // Nothing started: the next render tries again.
  }
}

/**
 * What the status line shows of PRD `prd`'s board in the main checkout at `root`: the slices of a
 * board under 10 minutes old, else `null`. When the board is missing or 60 seconds old and no
 * refresh holds the lock, it starts one in `cwd` (the session's folder) with `spawn`, never waiting;
 * without `spawn`, nothing starts. Writes nothing, never throws.
 */
export function cachedSlices({ root, prd, now, cwd, spawn = null, script, env }: {
  root: string;
  prd: number;
  now: number;
  cwd: string;
  spawn?: Spawn | null;
  script?: string;
  env?: NodeJS.ProcessEnv | undefined;
}): CachedSlice[] | null {
  const board = attempt(() => readBoard(root, prd), null);
  if (spawn && refreshDue(board, now) && !attempt(() => lockHeld(root, prd, now), true)) {
    startRefresh({ spawn, script: script ?? omniScript(), cwd, prd, env });
  }
  return shownSlices(board, now);
}

/** The folder of the board files, and the local folder's `.gitignore`, written once. */
function ensureBoardDir(root: string): void {
  mkdirSync(join(root, BOARD_DIR), { recursive: true });
  const ignore = join(root, LOCAL_DIR, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
}

/** Writes PRD `prd`'s board entry: to a temporary name, then renamed into place. */
export function writeBoard(root: string, prd: number, entry: WrittenEntry): void {
  ensureBoardDir(root);
  const path = boardFile(root, prd);
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(entry)}\n`);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** Creates the lock exclusively, holding `{ at, owner }`; `null` when it exists. */
function createLock(path: string, now: number): string | null {
  const owner = `${process.pid}-${randomUUID()}`;
  let fd: number;
  try {
    fd = openSync(path, 'wx');
  } catch (error) {
    if (prop(error, 'code') === 'EEXIST') return null;
    throw error;
  }
  try {
    writeFileSync(fd, `${JSON.stringify({ at: new Date(now).toISOString(), owner })}\n`);
  } finally {
    closeSync(fd);
  }
  return owner;
}

/** Takes PRD `prd`'s lock, taking over one 2 minutes old or more: its owner token, or `null` while
 * another refresh holds it. */
export function takeLock(root: string, prd: number, now: number): string | null {
  ensureBoardDir(root);
  const path = lockFile(root, prd);
  const owner = createLock(path, now);
  if (owner !== null || lockHeld(root, prd, now)) return owner;
  rmSync(path, { force: true });
  return createLock(path, now);
}

/** Removes PRD `prd`'s lock, unless another refresh took it over since `owner` took it. */
function releaseLock(root: string, prd: number, owner: string): void {
  const path = lockFile(root, prd);
  const held = attempt(() => readLock(path)?.owner, null);
  if (held === owner) rmSync(path, { force: true });
}

/** The first line of what `error` says. */
const oneLine = (error: unknown): string => (String(prop(error, 'message') ?? error).split('\n')[0] ?? '').trim() || 'the board could not be built';

/**
 * The refresh of PRD `prd`'s board in the main checkout at `root`: takes the lock (`'held'`, and
 * nothing written, while another refresh holds it), writes what `build()` returns as the board's
 * slices, or what it throws as the error entry, then removes the lock (`'written'`).
 */
export function refreshBoard({ root, prd, now, build }: { root: string; prd: number; now: number; build: () => readonly WrittenSlice[] }): 'written' | 'held' {
  const owner = takeLock(root, prd, now);
  if (owner === null) return 'held';
  try {
    const at = new Date(now).toISOString();
    let entry: WrittenEntry;
    try {
      entry = { at, slices: build().map(({ id, wave, state }) => ({ id, wave, state })) };
    } catch (error) {
      entry = { at, error: oneLine(error) };
    }
    writeBoard(root, prd, entry);
  } finally {
    releaseLock(root, prd, owner);
  }
  return 'written';
}
