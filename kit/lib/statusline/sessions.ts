// What a Claude session last worked on (PRD 324's spec, "The record", widened by PRD 1208's): the one
// PRD, fix or roadmap the latest command naming one named, kept per session so that the status line
// and `omni now` can show it on a branch that names none (a `/omni:yolo 315` started on `main`).
//
// - A record is `{ "kind": "prd" | "bug" | "visual" | "roadmap", "number": <n>, "at": "<iso time>" }`
//   in `.omni-loop/local/sessions/<session id>.json`,
//   in the repository's main checkout (`mainCheckout`, through `git rev-parse --git-common-dir`), so
//   that a command run in any worktree records it for the same session. The folder carries its own
//   `.gitignore` (`*`), as ask mode's does: nothing in it is ever committed.
// - The latest record wins. Writing one deletes the records in that folder older than 7 days, by
//   their `at` (by the file's own time when its `at` cannot be read); a file that is not a record is
//   left alone.
// - A session id becomes a file name only when `isSafeId` passes; any other writes and reads nothing.
//   A record that is missing, half-written or of the wrong shape reads as none; one of PRD 324's
//   shape, `{ "prd": <n>, "at" }`, reads as kind `prd`.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSafeId, LOCAL_DIR } from '../ask/local-state.ts';
import type { ExecText } from '../context.ts';
import { parsePrd } from '../ids.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { mainCheckout } from '../dossier/local.ts';
import { RECORD_KINDS, SessionRecordSchema } from './schema.ts';
import type { RecordKind, SessionRecord } from './schema.ts';

export const SESSIONS_DIR = join(LOCAL_DIR, 'sessions');
/** How long a record is kept once another is written. */
export const RECORD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECORD_EXT = '.json';

/** What a record names: a kind of work and its number. */
export type RecordedWork = { kind: RecordKind; number: IssueNumber };

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const isKind = (value: unknown): value is RecordKind => RECORD_KINDS.some((kind) => kind === value);
const recordPath = (root: string, sessionId: string): string => join(root, SESSIONS_DIR, `${sessionId}${RECORD_EXT}`);

/** The record in `path`, or `null`. */
function recordAt(path: string): SessionRecord | null {
  try {
    const parsed = SessionRecordSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** When the record in `path` was written: its `at`, else the file's own time. */
function writtenAt(path: string): number {
  const at = Date.parse(recordAt(path)?.at ?? '');
  return Number.isNaN(at) ? statSync(path).mtimeMs : at;
}

/** Deletes the records under `dir` written more than `RECORD_MAX_AGE_MS` before `now`; one that
 * cannot be read or deleted is skipped. */
function prune(dir: string, now: number): void {
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
 * Records that session `sessionId` works on the `kind` (a PRD when left out) numbered `number`, in
 * the checkout at `root`, then prunes the week-old records. `false`, and nothing written, for an
 * unsafe id, a kind it does not know or a number that is not a positive integer. Throws when the
 * disk refuses the write; the caller ignores it.
 */
export function writeRecord(root: string, sessionId: unknown, number: unknown, now: number, kind: unknown = 'prd'): boolean {
  if (!isSafeId(sessionId) || !isNumber(number) || !isKind(kind)) return false;
  const local = join(root, LOCAL_DIR);
  const dir = join(root, SESSIONS_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(local, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  writeFileSync(recordPath(root, sessionId), `${JSON.stringify({ kind, number, at: new Date(now).toISOString() })}\n`);
  prune(dir, now);
  return true;
}

/** Session `sessionId`'s record in the checkout at `root`: `{ kind, number, at }`, or `null`. */
export function readRecord(root: string, sessionId: unknown): SessionRecord | null {
  return isSafeId(sessionId) ? recordAt(recordPath(root, sessionId)) : null;
}

/**
 * Records the `kind` (a PRD when left out) numbered `number` for session `sessionId` in the main
 * checkout of the repository `cwd` is in, from the checkout itself or any of its worktrees. `false`
 * when nothing was written: an unsafe id (git is not even asked), no repository, a kind it does not
 * know or a number that is not a positive integer.
 */
export function recordSession({ cwd, exec, sessionId, kind = 'prd', number, now }: { cwd: string; exec: ExecText; sessionId: unknown; kind?: unknown; number: unknown; now: number }): boolean {
  if (!isSafeId(sessionId)) return false;
  const root = mainCheckout(cwd, exec);
  return root ? writeRecord(root, sessionId, number, now, kind) : false;
}

/**
 * The work session `sessionId` last worked on, `{ kind, number }`, read in the main checkout of the
 * repository `cwd` is in; `null` for none, an unsafe id, no repository, or anything that cannot be
 * read. Never throws.
 */
export function recordedWork({ cwd, exec, sessionId }: { cwd: string; exec: ExecText; sessionId: unknown }): RecordedWork | null {
  if (!isSafeId(sessionId)) return null;
  try {
    const root = mainCheckout(cwd, exec);
    const record = root ? readRecord(root, sessionId) : null;
    return record ? { kind: record.kind, number: record.number } : null;
  } catch {
    return null;
  }
}

/**
 * The PRD session `sessionId` last worked on: its record's number when the record is of kind `prd`,
 * else `null`, as `recordedWork` reads it. Never throws.
 */
export function recordedPrd({ cwd, exec, sessionId }: { cwd: string; exec: ExecText; sessionId: unknown }): PrdNumber | null {
  const work = recordedWork({ cwd, exec, sessionId });
  return work?.kind === 'prd' ? parsePrd(work.number) : null;
}
