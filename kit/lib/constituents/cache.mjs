// The last constituents `omni constituents` synced (PRD 871): `.omni-loop/local/constituents.json` in
// the repository's main checkout, beside ask mode's state and ignored by the same `.gitignore`, so a
// session in any worktree reads the copy any other synced. It is never committed: offline, the
// session prints this copy with its age.
//
// The file is `{ repo, syncedAt, read }`, `read` being the reply `constituentsOf` read. A file that is
// missing, half-written, of the wrong shape or for another repository reads as null.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCAL_DIR } from '../ask/local-state.mjs';
import { constituentsOf } from './read.mjs';

export const CONSTITUENTS_FILE = join(LOCAL_DIR, 'constituents.json');

/** The copy synced for `repo` under `root`, as `{ syncedAt, read }`, or null when there is none. */
export function readCache(root, repo) {
  let value;
  try {
    value = JSON.parse(readFileSync(join(root, CONSTITUENTS_FILE), 'utf8'));
  } catch {
    return null;
  }
  if (!value || value.repo !== repo || typeof value.syncedAt !== 'string' || Number.isNaN(Date.parse(value.syncedAt))) return null;
  const read = constituentsOf(value.read);
  return read ? { syncedAt: value.syncedAt, read } : null;
}

/** Keeps `read`, synced for `repo` at `syncedAt`, under `root`. */
export function writeCache(root, { repo, syncedAt, read }) {
  const dir = join(root, LOCAL_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
  writeFileSync(join(root, CONSTITUENTS_FILE), `${JSON.stringify({ repo, syncedAt, read }, null, 2)}\n`);
}
