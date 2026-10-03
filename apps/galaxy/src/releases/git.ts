// The sync's one reading of git (PRD 262): when each shipped PRD folder first reached main. A folder
// reaches main when the first commit on main's own line adds its spec.md there, the folder having
// usually been renamed from inbox/: `--no-renames` sees that rename as an addition. `--first-parent`
// keeps to main's own commits, so a folder merged by a merge commit is dated by the merge, and a squash
// merge by the squash: the moment it reached main, not when a branch shipped it. The date is the
// committer date, as the commit writes it (ISO 8601, with its offset).
//
// It reads the history of the checkout's HEAD: the releases workflow checks out main.
import { execFileSync } from 'node:child_process';

/** The commit that first put a file on main, and its committer date. */
export type FirstOnMain = { commit: string; committedAt: string };

/** Runs git in `cwd` and returns its standard output. */
export type Git = (args: string[], cwd: string) => string;

const git: Git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** Starts each commit's record in the log below, so its header cannot be taken for a file name. */
const RECORD = '\x1e';

/**
 * For each of `paths` (relative to `root`) that main's history ever added, the oldest commit on main
 * that added it. One walk of the history for them all; a path it never added is left out.
 */
export function firstAdded(root: string, paths: string[], run: Git = git): Map<string, FirstOnMain> {
  const found = new Map<string, FirstOnMain>();
  if (paths.length === 0) return found;
  const log = run(['log', '--first-parent', '--no-renames', '--diff-filter=A', `--format=${RECORD}%H %cI`, '--name-only', '--', ...paths], root);
  // Newest first: each older addition of a path replaces the one read before it.
  for (const record of log.split(RECORD).slice(1)) {
    const [header = '', ...files] = record.split('\n');
    // The format writes the hash, a space and the date: a header without both is no addition.
    const [commit, date] = header.trim().split(' ');
    if (!commit || !date) continue;
    // Git 2.50 and later print a UTC date as `Z`, earlier ones as `+00:00`: keep one form either way.
    const committedAt = date.replace(/Z$/, '+00:00');
    for (const file of files) if (file !== '') found.set(file, { commit, committedAt });
  }
  return found;
}
