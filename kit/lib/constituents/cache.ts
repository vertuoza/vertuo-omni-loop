// The last constituents `omni constituents` synced (PRD 871): `.omni-loop/local/constituents.json` in
// the repository's main checkout, beside ask mode's state and ignored by the same `.gitignore`, so a
// session in any worktree reads the copy any other synced. It is never committed: offline, the
// session prints this copy with its age.
//
// The file is `{ repo, syncedAt, read }`, `read` being the reply `constituentsOf` read. A file that is
// missing, half-written, of the wrong shape or for another repository reads as null.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { constituentsOf } from './read.ts';
import type { Constituents } from './read.ts';
import { ConstituentsCacheSchema } from './schema.ts';

export const CONSTITUENTS_FILE = join(LOCAL_DIR, 'constituents.json');

/** The copy synced for `repo` under `root`, as `{ syncedAt, read }`, or null when there is none. */
export function readCache(root: string, repo: string): { syncedAt: string; read: Constituents } | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, CONSTITUENTS_FILE), 'utf8'));
  } catch {
    return null;
  }
  const kept = ConstituentsCacheSchema.safeParse(value);
  if (!kept.success || kept.data.repo !== repo) return null;
  const read = constituentsOf(kept.data.read);
  return read ? { syncedAt: kept.data.syncedAt, read } : null;
}

/** Keeps `read`, synced for `repo` at `syncedAt`, under `root`. */
export function writeCache(root: string, { repo, syncedAt, read }: { repo: string; syncedAt: string; read: Constituents }): void {
  ensureLocalDir(root);
  writeFileSync(join(root, CONSTITUENTS_FILE), `${JSON.stringify({ repo, syncedAt, read }, null, 2)}\n`);
}
