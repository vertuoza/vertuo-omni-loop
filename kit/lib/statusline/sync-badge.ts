// The sync badge of the status line's second line (PRD 1990's spec, section 8): what `omni sync` last
// kept, read from the cache alone (`../sync/cache.ts`, which imports no `git`, no `gh` and nothing that
// reaches the network), and the one background refresh a stale cache starts.
//
// - The cache is read in the main checkout of the session's folder; none, or one that does not read,
//   is no badge.
// - It is stale when its `checkedAt` is 15 minutes old or more (a time after now counts as old), or
//   when there is none. A stale cache starts `node <script> sync --background`, detached, in the
//   folder, never waited for, unless a run holds the lock beside the cache. Without `spawn` or
//   `script`, nothing starts. Nothing here prints or writes a file.
import { mainCheckout } from '../dossier/local.ts';
import type { ExecText } from '../context.ts';
import { readSyncCache, syncLockHeld } from '../sync/cache.ts';
import type { SyncRecord } from '../sync/schema.ts';
import type { Spawn } from './board-cache.ts';

/** How old the cache may be before the status line starts a refresh. */
const SYNC_STALE_MS = 15 * 60 * 1000;

/** Whether the cache written at `checkedAt` is due a refresh at `now`: none, or 15 minutes old or more. */
function syncStale(record: Pick<SyncRecord, 'checkedAt'> | null, now: number): boolean {
  if (!record) return true;
  const age = now - Date.parse(record.checkedAt);
  return !(age >= 0 && age < SYNC_STALE_MS);
}

/** Starts `omni sync --background` in `folder`, detached. Never throws. */
function startSync({ folder, spawn, script, env }: { folder: string; spawn: Spawn; script: string; env: NodeJS.ProcessEnv | undefined }): void {
  try {
    const child = spawn(process.execPath, [script, 'sync', '--background'], {
      cwd: folder,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      ...(env ? { env } : {}),
    });
    child?.on?.('error', () => {});
    child?.unref?.();
  } catch {
    // The next render starts another.
  }
}

/**
 * The record `omni sync` last kept for the checkout `folder` sits in, or `null` for none, starting one
 * background refresh when it is stale and no run holds the lock. Never throws.
 */
export function readSyncBadge({ folder, exec, now, spawn, script, env }: { folder: string; exec: ExecText; now: number; spawn: Spawn | null; script: string | undefined; env: NodeJS.ProcessEnv | undefined }): SyncRecord | null {
  try {
    const root = mainCheckout(folder, exec);
    if (!root) return null;
    const record = readSyncCache(root);
    if (syncStale(record, now) && spawn && script && !syncLockHeld(root, now)) startSync({ folder, spawn, script, env });
    return record;
  } catch {
    return null;
  }
}
