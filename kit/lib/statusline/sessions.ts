// @ts-nocheck
// What a Claude session last worked on (PRD 324's spec, "The record"): the one PRD the latest command
// naming one named, kept per session so that the status line can show it on a branch that names no
// PRD (a `/omni:yolo 315` started on `main`).
//
// - A record is `{ "prd": <n>, "at": "<iso time>" }` in `.omni-loop/local/sessions/<session id>.json`,
//   in the repository's main checkout (`mainCheckout`, through `git rev-parse --git-common-dir`), so
//   that a command run in any worktree records it for the same session. The folder carries its own
//   `.gitignore` (`*`), as ask mode's does: nothing in it is ever committed.
// - The latest record wins. Writing one deletes the records in that folder older than 7 days, by
//   their `at` (by the file's own time when its `at` cannot be read); a file that is not a record is
//   left alone.
// - A session id becomes a file name only when `isSafeId` passes; any other writes and reads nothing.
//   A record that is missing, half-written or of the wrong shape reads as none.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSafeId, LOCAL_DIR } from '../ask/local-state.ts';
import { mainCheckout } from '../dossier/local.ts';

export const SESSIONS_DIR = join(LOCAL_DIR, 'sessions');
/** How long a record is kept once another is written. */
export const RECORD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECORD_EXT = '.json';

const isPrd = (value) => Number.isInteger(value) && value > 0;
const recordPath = (root, sessionId) => join(root, SESSIONS_DIR, `${sessionId}${RECORD_EXT}`);

/** The record in `path`, or `null`. */
function recordAt(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value) || !isPrd(value.prd)) return null;
    return { prd: value.prd, at: typeof value.at === 'string' ? value.at : null };
  } catch {
    return null;
  }
}

/** When the record in `path` was written: its `at`, else the file's own time. */
function writtenAt(path) {
  const at = Date.parse(recordAt(path)?.at ?? '');
  return Number.isNaN(at) ? statSync(path).mtimeMs : at;
}

/** Deletes the records under `dir` written more than `RECORD_MAX_AGE_MS` before `now`; one that
 * cannot be read or deleted is skipped. */
function prune(dir, now) {
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(RECORD_EXT)) continue;
    const path = join(dir, name);
    try {
      if (now - writtenAt(path) > RECORD_MAX_AGE_MS) rmSync(path, { force: true });
    } catch {
      // Gone already, or not ours to read: the next write tries again.
    }
  }
}

/**
 * Records that session `sessionId` works on PRD `prd`, in the checkout at `root`, then prunes the
 * week-old records. `false`, and nothing written, for an unsafe id or a PRD that is not a positive
 * integer. Throws when the disk refuses the write; the caller ignores it.
 */
export function writeRecord(root, sessionId, prd, now) {
  if (!isSafeId(sessionId) || !isPrd(prd)) return false;
  const local = join(root, LOCAL_DIR);
  const dir = join(root, SESSIONS_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(local, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  writeFileSync(recordPath(root, sessionId), `${JSON.stringify({ prd, at: new Date(now).toISOString() })}\n`);
  prune(dir, now);
  return true;
}

/** Session `sessionId`'s record in the checkout at `root`: `{ prd, at }`, or `null`. */
export function readRecord(root, sessionId) {
  return isSafeId(sessionId) ? recordAt(recordPath(root, sessionId)) : null;
}

/**
 * Records PRD `prd` for session `sessionId` in the main checkout of the repository `cwd` is in, from
 * the checkout itself or any of its worktrees. `false` when nothing was written: an unsafe id (git is
 * not even asked), no repository, or a PRD that is not a positive integer.
 *
 * @param {{ cwd: string, exec: Function, sessionId: unknown, prd: number, now: number }} options
 */
export function recordSession({ cwd, exec, sessionId, prd, now }) {
  if (!isSafeId(sessionId)) return false;
  const root = mainCheckout(cwd, exec);
  return root ? writeRecord(root, sessionId, prd, now) : false;
}

/**
 * The PRD session `sessionId` last worked on, read in the main checkout of the repository `cwd` is
 * in; `null` for none, an unsafe id, no repository, or anything that cannot be read. Never throws.
 *
 * @param {{ cwd: string, exec: Function, sessionId: unknown }} options
 */
export function recordedPrd({ cwd, exec, sessionId }) {
  if (!isSafeId(sessionId)) return null;
  try {
    const root = mainCheckout(cwd, exec);
    return root ? (readRecord(root, sessionId)?.prd ?? null) : null;
  } catch {
    return null;
  }
}
