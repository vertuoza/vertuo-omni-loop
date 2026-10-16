// The last run of `omni sync` (PRD 1990, spec section 4): `.omni-loop/local/sync.json` in the
// repository's main checkout, beside the constituents' copy and ignored by the same `.gitignore`, so
// every worktree of a checkout reads the one any other wrote. `omni sync` owns it: no other command
// writes it. The status line and the HUD read it here, so this file imports no `git`, no `gh` and
// nothing that reaches the network: it is handed the main checkout's root.
//
// A file that is missing, half-written or of another shape reads as `null`, and the next run writes
// it fresh. The run holds `sync.lock` beside it while it gathers: a lock under 2 minutes old means a
// run is under way, so a background refresh does not start a second one.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { LOCK_ABANDONED_MS, releaseLockAt, takeLockAt, writeJsonAt } from '../statusline/board-cache.ts';
import { SyncRecordSchema } from './schema.ts';
import type { SyncRecord } from './schema.ts';

export const SYNC_FILE = join(LOCAL_DIR, 'sync.json');
export const SYNC_LOCK = join(LOCAL_DIR, 'sync.lock');

const LockSchema = z.object({ at: z.string() });

/** The last run's record in the main checkout at `root`, or `null` when there is none it can read. */
export function readSyncCache(root: string): SyncRecord | null {
  try {
    const parsed = SyncRecordSchema.safeParse(JSON.parse(readFileSync(join(root, SYNC_FILE), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Keeps `record` in the main checkout at `root`: written to a temporary name, then renamed into place. */
export function writeSyncCache(root: string, record: SyncRecord): void {
  ensureLocalDir(root);
  writeJsonAt(join(root, SYNC_FILE), record);
}

/** Whether a run holds the lock in the main checkout at `root`: one under 2 minutes old at `now`. */
export function syncLockHeld(root: string, now: number): boolean {
  try {
    const parsed = LockSchema.safeParse(JSON.parse(readFileSync(join(root, SYNC_LOCK), 'utf8')));
    const at = parsed.success ? Date.parse(parsed.data.at) : Number.NaN;
    return now - at >= 0 && now - at < LOCK_ABANDONED_MS;
  } catch {
    return false;
  }
}

/** Takes the lock, taking over one 2 minutes old or more: its owner token, or `null` while a run holds it. */
export function takeSyncLock(root: string, now: number): string | null {
  ensureLocalDir(root);
  return takeLockAt(join(root, SYNC_LOCK), now);
}

/** Lets the lock go, unless another run took it over since `owner` took it. */
export function releaseSyncLock(root: string, owner: string): void {
  releaseLockAt(join(root, SYNC_LOCK), owner);
}
